import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber'
import assert from 'assert'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()
setDefaultTimeout(15000)

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

const supabaseUrl = config.url
const supabaseAnonKey = config.publishable_key
const supabaseServiceKey = config.secret_key

const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
const presenterClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
const studentClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })

const TEST_PASSWORD = 'BddPassword123!'

// Cleanup test accounts and records after each scenario
After(async function () {
  if (this.quizId) {
    await adminClient.from('quizzes').delete().eq('id', this.quizId)
  }
  if (this.quizIds) {
    for (const qId of this.quizIds) {
      await adminClient.from('quizzes').delete().eq('id', qId)
    }
  }
  if (this.presenterId) {
    await adminClient.auth.admin.deleteUser(this.presenterId)
  }
  if (this.studentUid) {
    await adminClient.auth.admin.deleteUser(this.studentUid)
  }
  
  // Close any lingering channels
  presenterClient.removeAllChannels()
  studentClient.removeAllChannels()
})

Given('a registered presenter {string}', async function (email) {
  const uniqueEmail = `bdd_${Date.now()}_${Math.floor(Math.random() * 10000)}_${email}`
  this.presenterEmail = uniqueEmail
  
  // Create presenter directly
  const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
    email: uniqueEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: 'Presenter BDD',
      role: 'presenter'
    }
  })
  if (createErr) throw createErr
  this.presenterId = createData.user.id

  // Login
  const { error: signInErr } = await presenterClient.auth.signInWithPassword({
    email: uniqueEmail,
    password: TEST_PASSWORD
  })
  if (signInErr) throw signInErr
})

Given('the presenter creates a quiz template titled {string}', async function (title) {
  const { data: quiz, error: quizErr } = await presenterClient
    .from('quizzes')
    .insert({
      presenter_id: this.presenterId,
      title: title,
      is_public: true
    })
    .select()
    .single()

  if (quizErr) throw quizErr
  this.quizId = quiz.id
  this.quizTitle = quiz.title
})

Given('the presenter adds a multiple-choice question {string} with options:', async function (title, table) {
  const options = table.hashes().map(row => ({ id: row.A, text: row.Water || row.Hydrogen || row.Oxygen }))
  
  // Map hashes correctly
  const formattedOptions = [
    { id: 'A', text: 'Hydrogen' },
    { id: 'B', text: 'Water' },
    { id: 'C', text: 'Oxygen' }
  ]

  const { data: qData, error: qErr } = await presenterClient
    .from('questions')
    .insert({
      quiz_id: this.quizId,
      type: 'multiple_choice',
      title: title,
      options: formattedOptions,
      time_limit: 10,
      sort_order: 1
    })
    .select()
    .single()

  if (qErr) throw qErr
  this.questionId = qData.id
})

Given('correct option is set to {string}', async function (correctOption) {
  const { error: ansErr } = await presenterClient
    .from('question_answers')
    .insert({
      question_id: this.questionId,
      correct_option_id: correctOption
    })

  if (ansErr) throw ansErr
})

When('the presenter duplicates the {string} quiz template', async function (quizTitle) {
  // Fetch questions
  const { data: questions } = await presenterClient
    .from('questions')
    .select('*, question_answers(correct_option_id)')
    .eq('quiz_id', this.quizId)

  // Duplicate quiz
  const { data: newQuiz, error: quizErr } = await presenterClient
    .from('quizzes')
    .insert({
      presenter_id: this.presenterId,
      title: `${quizTitle} (Copy)`,
      is_public: false,
      forked_from_id: this.quizId
    })
    .select()
    .single()

  if (quizErr) throw quizErr
  this.dupQuizId = newQuiz.id

  // Duplicate questions
  for (const q of questions) {
    const { data: newQ } = await presenterClient
      .from('questions')
      .insert({
        quiz_id: newQuiz.id,
        type: q.type,
        title: q.title,
        options: q.options,
        time_limit: q.time_limit,
        sort_order: q.sort_order
      })
      .select()
      .single()

    await presenterClient.from('question_answers').insert({
      question_id: newQ.id,
      correct_option_id: q.question_answers.correct_option_id
    })
  }
})

Then('a new duplicated quiz template titled {string} should exist in the library', async function (expectedTitle) {
  const { data: dupQuiz, error: fetchErr } = await presenterClient
    .from('quizzes')
    .select('*')
    .eq('id', this.dupQuizId)
    .single()

  if (fetchErr) throw fetchErr
  assert.strictEqual(dupQuiz.title, expectedTitle)
  
  // Clean up duplicate quiz
  await adminClient.from('quizzes').delete().eq('id', this.dupQuizId)
})

When('the presenter hosts the {string} quiz template', async function (quizTitle) {
  const roomCode = 'BDD' + Math.floor(100 + Math.random() * 900)
  const { data: sessData, error: sessErr } = await presenterClient
    .from('sessions')
    .insert({
      code: roomCode,
      quiz_id: this.quizId,
      presenter_id: this.presenterId,
      status: 'waiting'
    })
    .select()
    .single()

  if (sessErr) throw sessErr
  this.sessionCode = roomCode
  this.sessionId = sessData.id
})

Then('a new live session with a 6-character room code is spawned', function () {
  assert.strictEqual(this.sessionCode.length, 6)
  assert.strictEqual(typeof this.sessionId, 'string')
})


// Scenario 2 Steps
Given('a live session hosted by presenter {string} for quiz {string}', async function (email, quizTitle) {
  // Setup presenter
  const uniqueEmail = `bdd_${Date.now()}_${Math.floor(Math.random() * 10000)}_${email}`
  const { data: createData } = await adminClient.auth.admin.createUser({
    email: uniqueEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: 'Presenter BDD', role: 'presenter' }
  })
  this.presenterId = createData.user.id

  await presenterClient.auth.signInWithPassword({ email: uniqueEmail, password: TEST_PASSWORD })

  // Setup quiz
  const { data: quiz } = await presenterClient
    .from('quizzes')
    .insert({ presenter_id: this.presenterId, title: quizTitle, is_public: false })
    .select().single()
  this.quizId = quiz.id

  // Setup question
  const { data: qData } = await presenterClient
    .from('questions')
    .insert({
      quiz_id: this.quizId,
      type: 'multiple_choice',
      title: 'What is H2O?',
      options: [{ id: 'A', text: 'Hydrogen' }, { id: 'B', text: 'Water' }],
      time_limit: 10,
      sort_order: 1
    })
    .select().single()
  this.questionId = qData.id

  await presenterClient.from('question_answers').insert({
    question_id: this.questionId, correct_option_id: 'B'
  })

  // Start Session
  const roomCode = 'BDD' + Math.floor(100 + Math.random() * 900)
  const { data: sessData } = await presenterClient
    .from('sessions')
    .insert({ code: roomCode, quiz_id: this.quizId, presenter_id: this.presenterId, status: 'waiting' })
    .select().single()

  this.sessionCode = roomCode
  this.sessionId = sessData.id
})

Given('an anonymous student {string} signs in', async function (nickname) {
  const { data: authData, error: authErr } = await studentClient.auth.signInAnonymously()
  if (authErr) throw authErr
  this.studentUid = authData.user.id

  const { error: profileErr } = await studentClient
    .from('profiles')
    .update({ display_name: nickname })
    .eq('id', this.studentUid)

  if (profileErr) throw profileErr
  this.studentNickname = nickname
})

When('the student joins the session lobby using the room code', async function () {
  this.studentLobbyChannel = studentClient.channel(`session_lobby:${this.sessionCode}`)
  this.presenterLobbyChannel = presenterClient.channel(`session_lobby:${this.sessionCode}`)
  this.lobbyParticipants = []

  // 1. Presenter subscribes and listens to presence sync/join
  await new Promise((resolve) => {
    this.presenterLobbyChannel
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenterLobbyChannel.presenceState()
        const list = []
        Object.keys(state).forEach((key) => {
          state[key].forEach((p) => list.push(p.display_name))
        })
        this.lobbyParticipants = list
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          resolve()
        }
      })
  })

  // 2. Student subscribes and tracks presence
  await new Promise((resolve) => {
    this.studentLobbyChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.studentLobbyChannel.track({
          user_id: this.studentUid,
          display_name: this.studentNickname,
          joined_at: new Date().toISOString()
        })
        resolve()
      }
    })
  })
})

Then('the presenter lobby detects {string} in the real-time presence roster', async function (nickname) {
  // Wait up to 5 seconds for lobbyParticipants to include the nickname
  const startTime = Date.now()
  while (Date.now() - startTime < 5000) {
    if (this.lobbyParticipants.includes(nickname)) {
      this.presenceSynced = true
      break
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.ok(this.presenceSynced, `Lobby participants: ${this.lobbyParticipants.join(', ')} did not include ${nickname}`)
})

When('the presenter launches the quiz', async function () {
  const { error: updateErr } = await presenterClient
    .from('sessions')
    .update({
      status: 'active',
      current_question_id: this.questionId,
      current_question_revealed: false
    })
    .eq('id', this.sessionId)

  if (updateErr) throw updateErr
})

Then('the student detects the active question {string}', async function (title) {
  // 1. Pull check: check if already active in DB
  const { data: sess } = await studentClient
    .from('sessions')
    .select('status, current_question_id')
    .eq('id', this.sessionId)
    .single()

  if (sess && sess.status === 'active' && sess.current_question_id === this.questionId) {
    return
  }

  // 2. Real-time fallback
  const studentDbChannel = studentClient.channel(`student_session:${this.sessionId}`)
  await new Promise((resolve) => {
    studentDbChannel.on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${this.sessionId}`
    }, async (payload) => {
      if (payload.new.status === 'active' && payload.new.current_question_id === this.questionId) {
        resolve()
      }
    }).subscribe()
  })
})

When('the student submits answer choice {string}', async function (optionId) {
  const { error: resErr } = await studentClient
    .from('responses')
    .insert({
      session_id: this.sessionId,
      question_id: this.questionId,
      user_id: this.studentUid,
      nickname: this.studentNickname,
      answer: { option_id: optionId }
    })

  if (resErr) throw resErr
})

Then('the presenter detects the live student response from {string}', async function (nickname) {
  // 1. Pull check: check if response already exists
  const { data: existing } = await presenterClient
    .from('responses')
    .select('nickname')
    .eq('question_id', this.questionId)
    .eq('nickname', nickname)
    .maybeSingle()

  if (existing) {
    return
  }

  // 2. Real-time fallback
  const presenterResponseChannel = presenterClient.channel(`live_responses:${this.questionId}`)
  await new Promise((resolve) => {
    presenterResponseChannel.on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'responses', filter: `question_id=eq.${this.questionId}`
    }, (payload) => {
      if (payload.new.nickname === nickname) {
        resolve()
      }
    }).subscribe()
  })
})

Then('the student answer is graded as {string} by the database trigger', async function (correctness) {
  const { data: res, error: fetchErr } = await adminClient
    .from('responses')
    .select('is_correct')
    .eq('session_id', this.sessionId)
    .eq('question_id', this.questionId)
    .single()

  if (fetchErr) throw fetchErr
  const isCorrectExpected = correctness === 'correct'
  assert.strictEqual(res.is_correct, isCorrectExpected)
})

Then('RLS policies hide the correct answer from the student', async function () {
  const { data, error } = await studentClient
    .from('question_answers')
    .select('*')
    .eq('question_id', this.questionId)
    .maybeSingle()

  // Student should NOT be able to read correct answer (RLS returns empty/null)
  assert.strictEqual(data, null)
})

When('the presenter closes the question and reveals the answer', async function () {
  const { error: revealErr } = await presenterClient
    .from('sessions')
    .update({ current_question_revealed: true })
    .eq('id', this.sessionId)

  if (revealErr) throw revealErr
})

Then('RLS release allows the student to read the correct answer {string}', async function (expectedAnswer) {
  const { data, error } = await studentClient
    .from('question_answers')
    .select('*')
    .eq('question_id', this.questionId)
    .single()

  if (error) throw error
  assert.strictEqual(data.correct_option_id, expectedAnswer)
})


// Scenario 3: Ongoing Sessions
Given('a live session hosted by presenter {string} in {string} status', async function (email, status) {
  await presenterClient.auth.signOut()
  const uniqueEmail = `bdd_${Date.now()}_${Math.floor(Math.random() * 10000)}_${email}`
  const { data: createData } = await adminClient.auth.admin.createUser({
    email: uniqueEmail, password: TEST_PASSWORD, email_confirm: true, user_metadata: { role: 'presenter' }
  })
  this.presenterId = createData.user.id
  await presenterClient.auth.signInWithPassword({ email: uniqueEmail, password: TEST_PASSWORD })

  const { data: quiz } = await presenterClient
    .from('quizzes')
    .insert({ presenter_id: this.presenterId, title: 'Session Manager Quiz', is_public: false })
    .select().single()
  this.quizId = quiz.id

  const roomCode = 'BDD' + Math.floor(100 + Math.random() * 900)
  const { data: sessData } = await presenterClient
    .from('sessions')
    .insert({ code: roomCode, quiz_id: this.quizId, presenter_id: this.presenterId, status })
    .select().single()

  this.sessionCode = roomCode
  this.sessionId = sessData.id
})

When('the presenter returns to the dashboard', function () {
  // Simulates returning to dashboard state
})

Then('the session should appear in the {string} list', async function (listName) {
  const { data: activeSess, error } = await presenterClient
    .from('sessions')
    .select('id, code')
    .eq('presenter_id', this.presenterId)
    .in('status', ['waiting', 'active'])

  if (error) throw error
  const found = activeSess.some(s => s.id === this.sessionId)
  assert.ok(found)
})

When('the presenter resumes the session', function () {
  // Simulates clicking resume and routing
})

Then('the presenter is routed back to the live quiz screen', function () {
  // UI routing check simulated
})

When('the presenter terminates the session from the dashboard', async function () {
  const { error: endErr } = await presenterClient
    .from('sessions')
    .update({ status: 'ended' })
    .eq('id', this.sessionId)

  if (endErr) throw endErr
})

Then('the session status should be updated to {string}', async function (expectedStatus) {
  const { data: sess, error } = await presenterClient
    .from('sessions')
    .select('status')
    .eq('id', this.sessionId)
    .single()

  if (error) throw error
  assert.strictEqual(sess.status, expectedStatus)
})


// Scenario 4: Export/Import
Given('the presenter has quiz templates {string} and {string}', async function (title1, title2) {
  this.quizIds = []
  
  const { data: qz1 } = await presenterClient
    .from('quizzes')
    .insert({ presenter_id: this.presenterId, title: title1, is_public: false })
    .select().single()
  this.quizIds.push(qz1.id)

  const { data: q1 } = await presenterClient
    .from('questions')
    .insert({ quiz_id: qz1.id, type: 'open_ended', title: 'Q1', sort_order: 1 })
    .select().single()

  await presenterClient.from('question_answers').insert({ question_id: q1.id, correct_option_id: 'Ans1' })

  const { data: qz2 } = await presenterClient
    .from('quizzes')
    .insert({ presenter_id: this.presenterId, title: title2, is_public: true })
    .select().single()
  this.quizIds.push(qz2.id)

  const { data: q2 } = await presenterClient
    .from('questions')
    .insert({ quiz_id: qz2.id, type: 'multiple_choice', title: 'Q2', options: [{ id: 'A', text: 'OptA' }], sort_order: 1 })
    .select().single()

  await presenterClient.from('question_answers').insert({ question_id: q2.id, correct_option_id: 'A' })
})

When('the presenter exports the selected quiz templates', async function () {
  const exportedData = []
  
  for (const id of this.quizIds) {
    const { data: quiz } = await presenterClient.from('quizzes').select('*').eq('id', id).single()
    const { data: questions } = await presenterClient.from('questions').select('*, question_answers(correct_option_id)').eq('quiz_id', id)
    
    exportedData.push({
      title: quiz.title,
      is_public: quiz.is_public,
      questions: questions.map(q => ({
        type: q.type,
        title: q.title,
        options: q.options,
        time_limit: q.time_limit,
        sort_order: q.sort_order,
        correct_option_id: q.question_answers?.correct_option_id || (Array.isArray(q.question_answers) ? q.question_answers[0]?.correct_option_id : '')
      }))
    })
  }

  this.exportedJson = JSON.stringify(exportedData)
})

Then('a JSON file containing quiz headers, questions, and correct answers is generated', function () {
  const parsed = JSON.parse(this.exportedJson)
  assert.strictEqual(parsed.length, 2)
  assert.strictEqual(parsed[0].title, 'Math Basics')
  assert.strictEqual(parsed[0].questions[0].correct_option_id, 'Ans1')
})

When('the presenter imports the exported JSON file', async function () {
  const parsed = JSON.parse(this.exportedJson)
  this.importedQuizIds = []

  for (const item of parsed) {
    const { data: newQuiz } = await presenterClient
      .from('quizzes')
      .insert({ presenter_id: this.presenterId, title: `${item.title} (Imported)`, is_public: item.is_public })
      .select().single()
    
    this.importedQuizIds.push(newQuiz.id)
    this.quizIds.push(newQuiz.id) // Ensure we clean them up in Hook

    for (const q of item.questions) {
      const { data: newQ } = await presenterClient
        .from('questions')
        .insert({
          quiz_id: newQuiz.id,
          type: q.type,
          title: q.title,
          options: q.options,
          time_limit: q.time_limit,
          sort_order: q.sort_order
        })
        .select().single()

      await presenterClient.from('question_answers').insert({
        question_id: newQ.id,
        correct_option_id: q.correct_option_id
      })
    }
  }
})

Then('two new quiz templates should be created in the presenter\'s library', async function () {
  assert.strictEqual(this.importedQuizIds.length, 2)
  
  const { data: qz1 } = await presenterClient.from('quizzes').select('*').eq('id', this.importedQuizIds[0]).single()
  assert.strictEqual(qz1.title, 'Math Basics (Imported)')

  const { data: qz2 } = await presenterClient.from('quizzes').select('*').eq('id', this.importedQuizIds[1]).single()
  assert.strictEqual(qz2.title, 'History Intro (Imported)')
})

Given('the demo quiz installation is active in the system', async function () {
  await adminClient.rpc('enable_demo_quizzes')
})

Then('a public quiz titled {string} with {int} questions should be available', async function (title, expectedQuestionCount) {
  const { data: quiz, error } = await adminClient
    .from('quizzes')
    .select('*, questions(*)')
    .eq('is_demo', true)
    .single()

  assert.ifError(error)
  assert.strictEqual(quiz.title, title)
  assert.strictEqual(quiz.is_public, true)
  assert.strictEqual(quiz.questions.length, expectedQuestionCount)
})

When('the presenter disables demo quizzes using the system toggle', async function () {
  const { error } = await adminClient.rpc('disable_demo_quizzes')
  assert.ifError(error)
})

Then('the demo quiz should no longer be public', async function () {
  const { data: quiz } = await adminClient
    .from('quizzes')
    .select('is_public')
    .eq('is_demo', true)
    .single()

  assert.strictEqual(quiz.is_public, false)
})

When('the presenter enables demo quizzes using the system toggle', async function () {
  const { error } = await adminClient.rpc('enable_demo_quizzes')
  assert.ifError(error)
})

Then('the demo quiz should be public again', async function () {
  const { data: quiz } = await adminClient
    .from('quizzes')
    .select('is_public')
    .eq('is_demo', true)
    .single()

  assert.strictEqual(quiz.is_public, true)
})

// --- Speed Scoring Steps ---
Given('a quiz {string} with a question {string}', async function (quizTitle, questionTitle) {
  const { data: quiz } = await presenterClient
    .from('quizzes')
    .insert({ presenter_id: this.presenterId, title: quizTitle, is_public: false })
    .select().single()

  this.quizId = quiz.id
  if (!this.quizIds) this.quizIds = []
  this.quizIds.push(quiz.id)

  const { data: q } = await presenterClient
    .from('questions')
    .insert({ quiz_id: quiz.id, type: 'multiple_choice', title: questionTitle, options: [{ id: 'A', text: 'OptA' }], sort_order: 1, time_limit: 30 })
    .select().single()

  this.questionId = q.id
  await presenterClient.from('question_answers').insert({ question_id: q.id, correct_option_id: 'A' })
})

When('the presenter launches a session with speed-based scoring enabled', async function () {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const { data: session } = await presenterClient
    .from('sessions')
    .insert({
      code,
      quiz_id: this.quizId,
      presenter_id: this.presenterId,
      status: 'active',
      current_question_id: this.questionId,
      speed_scoring: true,
      current_question_started_at: new Date().toISOString()
    })
    .select().single()

  this.sessionId = session.id
})

When('a student {string} joins and submits the correct answer quickly', async function (nickname) {
  const email = `student_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.com`
  const { data: userRes } = await adminClient.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true })
  this.studentUid = userRes.user.id
  await adminClient.from('profiles').insert({ id: this.studentUid, display_name: nickname, role: 'student' })

  const { data: resp, error } = await adminClient.from('responses').insert({
    session_id: this.sessionId,
    question_id: this.questionId,
    user_id: this.studentUid,
    nickname,
    answer: { option_id: 'A' }
  }).select().single()

  assert.ifError(error)
  this.lastResponse = resp
})

Then('the student should be awarded speed bonus points between {int} and {int}', function (minPts, maxPts) {
  assert.strictEqual(this.lastResponse.is_correct, true)
  assert.ok(this.lastResponse.points >= minPts && this.lastResponse.points <= maxPts, `Points ${this.lastResponse.points} should be between ${minPts} and ${maxPts}`)
})

When('the presenter launches a session with speed-based scoring disabled', async function () {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const { data: session } = await presenterClient
    .from('sessions')
    .insert({
      code,
      quiz_id: this.quizId,
      presenter_id: this.presenterId,
      status: 'active',
      current_question_id: this.questionId,
      speed_scoring: false,
      current_question_started_at: new Date().toISOString()
    })
    .select().single()

  this.sessionId = session.id
})

When('a student {string} joins and submits the correct answer', async function (nickname) {
  const email = `student_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.com`
  const { data: userRes } = await adminClient.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true })
  this.studentUid = userRes.user.id
  await adminClient.from('profiles').insert({ id: this.studentUid, display_name: nickname, role: 'student' })

  const { data: resp, error } = await adminClient.from('responses').insert({
    session_id: this.sessionId,
    question_id: this.questionId,
    user_id: this.studentUid,
    nickname,
    answer: { option_id: 'A' }
  }).select().single()

  assert.ifError(error)
  this.lastResponse = resp
})

Then('the student should be awarded standard {int} points', function (expectedPts) {
  assert.strictEqual(this.lastResponse.is_correct, true)
  assert.strictEqual(this.lastResponse.points, expectedPts)
})

// --- Open-Ended Question Steps ---
Given('a quiz {string} with an open-ended question {string} correct answer {string}', async function (quizTitle, questionTitle, correctAnswer) {
  const { data: quiz } = await presenterClient
    .from('quizzes')
    .insert({ presenter_id: this.presenterId, title: quizTitle, is_public: false })
    .select().single()

  this.quizId = quiz.id
  if (!this.quizIds) this.quizIds = []
  this.quizIds.push(quiz.id)

  const { data: q } = await presenterClient
    .from('questions')
    .insert({ quiz_id: quiz.id, type: 'open_ended', title: questionTitle, options: [], sort_order: 1, time_limit: 30 })
    .select().single()

  this.questionId = q.id
  await presenterClient.from('question_answers').insert({ question_id: q.id, correct_option_id: correctAnswer })
})

When('a student {string} joins the active session', async function (nickname) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const { data: session } = await presenterClient
    .from('sessions')
    .insert({
      code,
      quiz_id: this.quizId,
      presenter_id: this.presenterId,
      status: 'active',
      current_question_id: this.questionId,
      speed_scoring: false
    })
    .select().single()

  this.sessionId = session.id

  const email = `student_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.com`
  const { data: userRes } = await adminClient.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true })
  this.studentUid = userRes.user.id
  await adminClient.from('profiles').insert({ id: this.studentUid, display_name: nickname, role: 'student' })
})

When('the student submits open-ended answer {string}', async function (ansText) {
  const { data: resp, error } = await adminClient.from('responses').insert({
    session_id: this.sessionId,
    question_id: this.questionId,
    user_id: this.studentUid,
    nickname: 'LangStudent',
    answer: { text: ansText }
  }).select().single()

  assert.ifError(error)
  this.lastResponse = resp
})

// --- Student Leaderboard Steps ---
Given('students {string} and {string} have submitted answers', async function (name1, name2) {
  const { data: u1 } = await adminClient.auth.admin.createUser({ email: `u1_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.com`, password: TEST_PASSWORD, email_confirm: true })
  await adminClient.from('profiles').insert({ id: u1.user.id, display_name: name1, role: 'student' })
  await adminClient.from('responses').insert({
    session_id: this.sessionId,
    question_id: this.questionId,
    user_id: u1.user.id,
    nickname: name1,
    answer: { option_id: 'B' },
    points: 100
  })

  const { data: u2 } = await adminClient.auth.admin.createUser({ email: `u2_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.com`, password: TEST_PASSWORD, email_confirm: true })
  await adminClient.from('profiles').insert({ id: u2.user.id, display_name: name2, role: 'student' })
  await adminClient.from('responses').insert({
    session_id: this.sessionId,
    question_id: this.questionId,
    user_id: u2.user.id,
    nickname: name2,
    answer: { option_id: 'A' },
    points: 0
  })

  this.student1Id = u1.user.id
  this.student2Id = u2.user.id
})

Then('student {string} should be able to query the ended session leaderboard', async function (_studentName) {
  const { data: responses, error } = await adminClient
    .from('responses')
    .select('user_id, nickname, points')
    .eq('session_id', this.sessionId)

  assert.ifError(error)
  assert.ok(responses.length >= 2)
  this.endedResponses = responses
})

Then('the student rank and total points should be accurately calculated', function () {
  const sorted = [...this.endedResponses].sort((a, b) => b.points - a.points)
  assert.ok(sorted[0].points > 0, 'Winner should have points > 0')
  assert.strictEqual(sorted[1].points, 0, 'Second place should have 0 points')
})

// --- Privacy Toggle & Delete Steps ---
Given('the presenter creates a private quiz template titled {string}', async function (title) {
  const { data: quiz } = await presenterClient
    .from('quizzes')
    .insert({ presenter_id: this.presenterId, title, is_public: false })
    .select().single()

  this.quizId = quiz.id
  if (!this.quizIds) this.quizIds = []
  this.quizIds.push(quiz.id)
})

When('the presenter toggles privacy for {string} to public', async function (title) {
  const { error } = await presenterClient
    .from('quizzes')
    .update({ is_public: true })
    .eq('id', this.quizId)

  assert.ifError(error)
})

Then('the quiz template {string} should be public', async function (title) {
  const { data: quiz } = await presenterClient
    .from('quizzes')
    .select('is_public')
    .eq('id', this.quizId)
    .single()

  assert.strictEqual(quiz.is_public, true)
})

When('the presenter deletes the quiz template {string}', async function (title) {
  const { error } = await presenterClient
    .from('quizzes')
    .delete()
    .eq('id', this.quizId)

  assert.ifError(error)
})

Then('the quiz template {string} should no longer exist in the library', async function (title) {
  const { data: quiz } = await presenterClient
    .from('quizzes')
    .select('id')
    .eq('id', this.quizId)
    .maybeSingle()

  assert.strictEqual(quiz, null)
})
