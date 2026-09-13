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

