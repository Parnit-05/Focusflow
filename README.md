# FocusFlow

A student-built Todo List web application using Node.js, Express, MongoDB and Mongoose.

## Features

- Sign up
- Sign in
- Logout
- Session-based authentication
- Add tasks
- Tick / untick tasks
- Delete tasks
- Due dates
- Daily repetition
- Weekly repetition
- Every 2 weeks
- Monthly repetition
- Daily completion streak
- Persistent task and user data using MongoDB
- Mongoose schemas and models for users and tasks
- MongoDB-backed user sessions

## Tech Stack

### Frontend
- HTML
- CSS
- JavaScript

### Backend
- Node.js
- Express.js
- Express Session
- bcryptjs

### Database
- MongoDB
- Mongoose
- connect-mongo

## Project Structure

```text
FocusFlow/
│
├── models/
│   ├── User.js
│   └── Task.js
│
├── utils/
│   └── taskUtils.js
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js