# Tasks

1. Combine the two headers into 1 header. 
2. Create a login page for OTP where the input is of type email. Acceptance criteria the user enters email. The page switches to the OTP input view that expects a 6 digit code. THe backend server logs the email and sends a 6 digit code. Right now we will read the backend logs and enter the 6 digit code into the OTP view. The OTP view sends the code back to the server. The server verifies the OTP code with the one it sent. Creates a secure http-only cookie saving session into cookie. 
3. The homepage will show an app button on the header instead of the profile button
4. when a user clicks on the app button the backend will check the user cookie for an active session if there is no session then the login OTP page will show allowing the user to enter their email. If there is a session already that is not expired then show the /task view
5. the mobile hamburger menu doesn't hide the goals_sidebar. It needs to be toggled
6. The backend server needs to be updated to handle users, sessions, tasks, boards, cards, and etc.. should be created for 1 user.


