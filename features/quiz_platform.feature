Feature: Yalcit Interactive Quiz Platform

  As a Presenter
  I want to define quiz templates, spawn active session room codes, and toggle sharing options
  As a Student
  I want to join sessions anonymously with a nickname and submit answers

  Scenario: Reusable Quiz Lifecycle (Duplication and Hosting)
    Given a registered presenter "presenter_bdd@gmail.com"
    And the presenter creates a quiz template titled "Science Trivia"
    And the presenter adds a multiple-choice question "What is H2O?" with options:
      | A | Hydrogen |
      | B | Water    |
      | C | Oxygen   |
    And correct option is set to "B"
    When the presenter duplicates the "Science Trivia" quiz template
    Then a new duplicated quiz template titled "Science Trivia (Copy)" should exist in the library
    And the presenter hosts the "Science Trivia" quiz template
    Then a new live session with a 6-character room code is spawned

  Scenario: Live Interaction & Server-Side Correctness Grading
    Given a live session hosted by presenter "presenter_bdd@gmail.com" for quiz "Science Trivia"
    And an anonymous student "BDDStudent" signs in
    When the student joins the session lobby using the room code
    Then the presenter lobby detects "BDDStudent" in the real-time presence roster
    When the presenter launches the quiz
    Then the student detects the active question "What is H2O?"
    When the student submits answer choice "B"
    Then the presenter detects the live student response from "BDDStudent"
    And the student answer is graded as "correct" by the database trigger
    And RLS policies hide the correct answer from the student
    When the presenter closes the question and reveals the answer
    Then RLS release allows the student to read the correct answer "B"

  Scenario: Dashboard Ongoing Sessions Control
    Given a live session hosted by presenter "presenter_bdd@gmail.com" in "active" status
    When the presenter returns to the dashboard
    Then the session should appear in the "Ongoing Sessions" list
    When the presenter resumes the session
    Then the presenter is routed back to the live quiz screen
    When the presenter terminates the session from the dashboard
    Then the session status should be updated to "ended"

  Scenario: JSON Import and Export
    Given a registered presenter "presenter_bdd@gmail.com"
    And the presenter has quiz templates "Math Basics" and "History Intro"
    When the presenter exports the selected quiz templates
    Then a JSON file containing quiz headers, questions, and correct answers is generated
    When the presenter imports the exported JSON file
    Then two new quiz templates should be created in the presenter's library

  Scenario: Public Demo Quiz Installation & Toggling
    Given the demo quiz installation is active in the system
    Then a public quiz titled "🇫🇷 Learn French for Beginners (Demo)" with 12 questions should be available
    When the presenter disables demo quizzes using the system toggle
    Then the demo quiz should no longer be public
    When the presenter enables demo quizzes using the system toggle
    Then the demo quiz should be public again

  Scenario: Speed-Based Scoring & Standard Scoring Calculation
    Given a registered presenter "presenter_bdd@gmail.com"
    And a quiz "Speed Quiz" with a question "Fast Math"
    When the presenter launches a session with speed-based scoring enabled
    And a student "FastStudent" joins and submits the correct answer quickly
    Then the student should be awarded speed bonus points between 500 and 1000
    When the presenter launches a session with speed-based scoring disabled
    And a student "StandardStudent" joins and submits the correct answer
    Then the student should be awarded standard 100 points

  Scenario: Open-Ended Question Realtime Grading
    Given a registered presenter "presenter_bdd@gmail.com"
    And a quiz "French Vocabulary" with an open-ended question "What is Thank You?" correct answer "Merci"
    When a student "LangStudent" joins the active session
    And the student submits open-ended answer " merci "
    Then the student answer is graded as "correct" by the database trigger

  Scenario: Student Final Leaderboard & RLS Access on Quiz Completion
    Given a live session hosted by presenter "presenter_bdd@gmail.com" for quiz "Science Trivia"
    And students "Alice" and "Bob" have submitted answers
    When the presenter terminates the session from the dashboard
    Then student "Alice" should be able to query the ended session leaderboard
    And the student rank and total points should be accurately calculated

  Scenario: Quiz Template Privacy Toggle and Deletion
    Given a registered presenter "presenter_bdd@gmail.com"
    And the presenter creates a private quiz template titled "Secret Quiz"
    When the presenter toggles privacy for "Secret Quiz" to public
    Then the quiz template "Secret Quiz" should be public
    When the presenter deletes the quiz template "Secret Quiz"
    Then the quiz template "Secret Quiz" should no longer exist in the library


