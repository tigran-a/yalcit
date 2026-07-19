import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Read credentials
const credentialsContent = fs.readFileSync('../supabase.credentials', 'utf8')
const config = {}
credentialsContent.split('\n').forEach(line => {
  const parts = line.split(':')
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const value = parts.slice(1).join(':').trim().replace(/['"]/g, '')
    if (key && value) {
      config[key] = value
    }
  }
})

const url = config.url
const anonKey = config.publishable_key
const serviceKey = config.secret_key

if (!url || !anonKey) {
  console.error("Missing URL or publishable key in credentials.")
  process.exit(1)
}

console.log("Supabase URL:", url)

// Initialize clients
const presenterClient = createClient(url, anonKey, { auth: { persistSession: false } })
const studentClient = createClient(url, anonKey, { auth: { persistSession: false } })
const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } })

const TEST_EMAIL = `presenter_${Date.now()}@gmail.com`
const TEST_PASSWORD = 'password123'
const STUDENT_NICKNAME = 'TestStudent'

async function runTest() {
  console.log("\n--- STARTING E2E INTEGRATION TEST ---\n")

  let presenterUser = null
  let quiz = null
  let session = null
  let question = null

  try {
    // 1. Create Presenter using Admin Client (bypassing rate limits & confirmation emails)
    console.log(`[Admin] Creating presenter account ${TEST_EMAIL}...`)
    const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: 'Presenter Bob',
        role: 'presenter'
      }
    })

    if (createErr) throw createErr
    presenterUser = createData.user
    console.log(`[Presenter] Account created. UID: ${presenterUser.id}`)

    console.log(`[Presenter] Logging in...`)
    const { data: signInData, error: signInErr } = await presenterClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
    if (signInErr) throw signInErr
    console.log("[Presenter] Login successful!")

    // Double check profile creation by trigger
    console.log("[Database] Verifying presenter profile was created by trigger...")
    const { data: profile, error: profileErr } = await presenterClient
      .from('profiles')
      .select('*')
      .eq('id', presenterUser.id)
      .single()

    if (profileErr || !profile) {
      throw new Error(`Presenter profile trigger failed: ${profileErr?.message || 'No profile row'}`)
    }
    console.log(`[Database] Presenter profile verified: Role = ${profile.role}`)

    // 2. Presenter Creates Quiz template
    console.log(`[Presenter] Creating quiz template...`)
    const { data: quizData, error: quizErr } = await presenterClient
      .from('quizzes')
      .insert({
        presenter_id: presenterUser.id,
        title: 'Integration Test Quiz'
      })
      .select()
      .single()

    if (quizErr) throw quizErr
    quiz = quizData
    console.log(`[Presenter] Quiz template created. ID: ${quiz.id}`)

    console.log(`[Presenter] Creating question & secure answer...`)
    const { data: qData, error: qErr } = await presenterClient
      .from('questions')
      .insert({
        quiz_id: quiz.id,
        type: 'multiple_choice',
        title: 'What is 1 + 1?',
        options: [
          { id: 'A', text: '1' },
          { id: 'B', text: '2' }
        ],
        time_limit: 10,
        sort_order: 1
      })
      .select()
      .single()

    if (qErr) throw qErr
    question = qData
    console.log(`[Presenter] Question created. ID: ${question.id}`)

    const { error: ansErr } = await presenterClient
      .from('question_answers')
      .insert({
        question_id: question.id,
        correct_option_id: 'B'
      })

    if (ansErr) throw ansErr
    console.log(`[Presenter] Secure answer registered.`)

    // Verify Duplication API behavior
    console.log(`[Presenter] Testing Quiz Duplication...`)
    const { data: dupQuizData, error: dupQuizErr } = await presenterClient
      .from('quizzes')
      .insert({
        presenter_id: presenterUser.id,
        title: `${quiz.title} (Copy)`,
        forked_from_id: quiz.id
      })
      .select()
      .single()

    if (dupQuizErr) throw dupQuizErr
    console.log(`[Presenter] Duplicated quiz template successfully. ID: ${dupQuizData.id}`)
    await presenterClient.from('quizzes').delete().eq('id', dupQuizData.id)

    const roomCode = 'TEST' + Math.floor(10 + Math.random() * 90)
    console.log(`[Presenter] Creating session with code: ${roomCode} for quiz: ${quiz.id}...`)
    const { data: sessData, error: sessErr } = await presenterClient
      .from('sessions')
      .insert({
        code: roomCode,
        quiz_id: quiz.id,
        presenter_id: presenterUser.id,
        status: 'waiting'
      })
      .select()
      .single()

    if (sessErr) throw sessErr
    session = sessData
    console.log(`[Presenter] Session created successfully. ID: ${session.id}`)

    // 3. Student signs in anonymously
    console.log(`[Student] Signing in anonymously...`)
    const { data: studAuthData, error: studAuthErr } = await studentClient.auth.signInAnonymously()
    if (studAuthErr) throw studAuthErr
    const studentUser = studAuthData.user
    console.log(`[Student] Anonymous login complete. UID: ${studentUser.id}`)

    console.log(`[Student] Updating nickname profile row to ${STUDENT_NICKNAME}...`)
    // Wait a brief moment for database trigger to create profiles row
    await new Promise(resolve => setTimeout(resolve, 500))

    const { data: studProfile, error: studProfErr } = await studentClient
      .from('profiles')
      .update({ display_name: STUDENT_NICKNAME })
      .eq('id', studentUser.id)
      .select()
      .single()

    if (studProfErr) throw studProfErr
    console.log(`[Student] Profile nickname successfully updated: ${studProfile.display_name}`)

    // 4. Test Presence Lobby sync
    console.log(`[Student] Joining lobby presence channel session_lobby:${roomCode}...`)
    const studentLobbyChannel = studentClient.channel(`session_lobby:${roomCode}`)
    const presenterLobbyChannel = presenterClient.channel(`session_lobby:${roomCode}`)

    let presenceSyncPromise = new Promise((resolve) => {
      presenterLobbyChannel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = presenterLobbyChannel.presenceState()
          console.log(`[Presenter] Presence synchronized. Active peers:`, Object.keys(presenceState).length)
          if (Object.keys(presenceState).length > 0) {
            resolve(true)
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Presenter] Subscribed to lobby presence.`)
          }
        })
    })

    studentLobbyChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Student] Subscribed and tracking presence...`)
        await studentLobbyChannel.track({
          user_id: studentUser.id,
          display_name: STUDENT_NICKNAME,
          joined_at: new Date().toISOString()
        })
      }
    })

    // Wait for presence synchronization
    await Promise.race([
      presenceSyncPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Presence sync timeout")), 8000))
    ])
    console.log("[Realtime] Presence synchronization verified successfully!")

    // 5. Test Question navigation sync via db updates
    console.log(`[Student] Subscribing to sessions row updates...`)
    let studentQuestionReceivedPromise = new Promise((resolve) => {
      const studentSessionSub = studentClient
        .channel(`student_session:${session.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sessions',
            filter: `id=eq.${session.id}`,
          },
          (payload) => {
            console.log(`[Student] Real-time session state update detected! Status: ${payload.new.status}, Active Q: ${payload.new.current_question_id}`)
            if (payload.new.status === 'active' && payload.new.current_question_id === question.id) {
              resolve(true)
              studentClient.removeChannel(studentSessionSub)
            }
          }
        )
        .subscribe()
    })

    console.log(`[Presenter] Launching quiz (updating session status & current_question)...`)
    const { error: launchErr } = await presenterClient
      .from('sessions')
      .update({
        status: 'active',
        current_question_id: question.id,
        current_question_revealed: false
      })
      .eq('id', session.id)

    if (launchErr) throw launchErr

    await Promise.race([
      studentQuestionReceivedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Student did not receive active question event")), 6000))
    ])
    console.log("[Realtime] Question transition broadcast verified successfully!")

    // 6. Test Response submission and Postgres Changes triggers
    console.log(`[Presenter] Subscribing to live student responses...`)
    let presenterResponseReceivedPromise = new Promise((resolve) => {
      const presenterResponseSub = presenterClient
        .channel(`live_responses:${question.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'responses',
            filter: `question_id=eq.${question.id}`,
          },
          (payload) => {
            console.log(`[Presenter] Live student response received: nickname = ${payload.new.nickname}, answer = ${JSON.stringify(payload.new.answer)}`)
            resolve(payload.new)
            presenterClient.removeChannel(presenterResponseSub)
          }
        )
        .subscribe()
    })

    console.log(`[Student] Submitting answer option B...`)
    const { error: respSubmitErr } = await studentClient
      .from('responses')
      .insert({
        session_id: session.id,
        question_id: question.id,
        user_id: studentUser.id,
        nickname: STUDENT_NICKNAME,
        answer: { option_id: 'B' }
      })

    if (respSubmitErr) throw respSubmitErr

    const submittedResponse = await Promise.race([
      presenterResponseReceivedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Presenter did not receive student response event")), 6000))
    ])
    console.log("[Realtime] Response submission listener verified successfully!")

    // 7. Verify Server-Side grading trigger
    console.log("[Database] Checking if server-side grading trigger evaluated correctness...")
    const { data: gradedResp, error: checkGradedErr } = await presenterClient
      .from('responses')
      .select('is_correct')
      .eq('id', submittedResponse.id)
      .single()

    if (checkGradedErr) throw checkGradedErr
    if (gradedResp.is_correct !== true) {
      throw new Error(`Correctness trigger failed: expected is_correct = true, got ${gradedResp.is_correct}`)
    }
    console.log("[Database] Server-side correctness trigger verified: answer B is correct!")

    // 8. Test Reveal Answer RLS policy
    console.log("[Student] Verifying correct answer is NOT readable yet due to RLS...")
    const { data: answerPreReveal, error: answerPreRevealErr } = await studentClient
      .from('question_answers')
      .select('*')
      .eq('question_id', question.id)
      .maybeSingle()

    if (answerPreReveal) {
      throw new Error("Security breach: student read correct answer before it was revealed!")
    }
    console.log("[Security] RLS protection verified: correct answer is hidden from student.")

    console.log("[Presenter] Closing question and revealing correct answer...")
    const { error: revealErr } = await presenterClient
      .from('sessions')
      .update({ current_question_revealed: true })
      .eq('id', session.id)

    if (revealErr) throw revealErr

    console.log("[Student] Verifying correct answer IS readable now that it is revealed...")
    const { data: answerPostReveal, error: answerPostRevealErr } = await studentClient
      .from('question_answers')
      .select('*')
      .eq('question_id', question.id)
      .single()

    if (answerPostRevealErr || !answerPostReveal) {
      throw new Error(`Failed to read correct answer post-reveal: ${answerPostRevealErr?.message}`)
    }
    console.log(`[Security] RLS release verified: student retrieved correct answer = ${answerPostReveal.correct_option_id}`)

    console.log("\n--- ALL E2E TESTS PASSED SUCCESSFULLY! ---")

  } catch (err) {
    console.error("\n❌ E2E TEST FAILED:", err.message || err)
    process.exit(1)
  } finally {
    // Cleanup database testing rows
    console.log("\n[CleanUp] Deleting test records...")
    if (quiz) {
      await adminClient.from('quizzes').delete().eq('id', quiz.id)
      console.log(`[CleanUp] Deleted quiz ${quiz.id}`)
    }
    if (presenterUser) {
      await adminClient.auth.admin.deleteUser(presenterUser.id)
      console.log(`[CleanUp] Deleted presenter user ${presenterUser.id}`)
    }
    if (studentClient.auth.getUser()) {
      const user = (await studentClient.auth.getUser()).data.user
      if (user) {
        await adminClient.auth.admin.deleteUser(user.id)
        console.log(`[CleanUp] Deleted student user ${user.id}`)
      }
    }
    process.exit(0)
  }
}

runTest()
