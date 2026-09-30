const express = require("express");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

const User = require("./models/User");
const Task = require("./models/Task");

const {
    dateKey,
    nextDate,
    getStreak
} = require("./utils/taskUtils");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!MONGODB_URI) {
    console.error("MONGODB_URI is missing from .env");
    process.exit(1);
}

if (!SESSION_SECRET) {
    console.error("SESSION_SECRET is missing from .env");
    process.exit(1);
}

// Middleware
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));


// MongoDB connection
mongoose
    .connect(MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    });


// Session configuration
app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl: MONGODB_URI
        }),

        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7,
            httpOnly: true,
            sameSite: "lax"
        }
    })
);


// Authentication middleware
function auth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please sign in"
        });
    }

    next();
}


// SIGN UP
app.post("/api/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
            });
        }

        const cleanEmail = email.toLowerCase().trim();

        const exists = await User.findOne({
            email: cleanEmail
        });

        if (exists) {
            return res.status(400).json({
                message: "Email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await User.create({
            id: Date.now().toString(),
            name: name.trim(),
            email: cleanEmail,
            passwordHash
        });

        req.session.userId = user.id;

req.session.save((error) => {
    if (error) {
        console.error("Session save error:", error);

        return res.status(500).json({
            message: "Could not create login session"
        });
    }

    res.json({
        id: user.id,
        name: user.name,
        email: user.email
    });
});

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not create account"
        });
    }
});


// SIGN IN
app.post("/api/signin", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const valid = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!valid) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        req.session.userId = user.id;

        // Make sure the session is saved before responding
        req.session.save((error) => {
            if (error) {
                console.error("Session save error:", error);

                return res.status(500).json({
                    message: "Could not create login session"
                });
            }

            res.json({
                id: user.id,
                name: user.name,
                email: user.email
            });
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not sign in"
        });
    }
});

// LOGOUT
app.post("/api/logout", auth, (req, res) => {
    req.session.destroy(() => {
        res.json({
            message: "Logged out"
        });
    });
});


// CURRENT USER
app.get("/api/me", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                message: "Not signed in"
            });
        }

        const user = await User.findOne({
            id: req.session.userId
        });

        if (!user) {
            return res.status(401).json({
                message: "User not found"
            });
        }

        res.json({
            id: user.id,
            name: user.name,
            email: user.email
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not load user"
        });
    }
});


// GET TASKS
app.get("/api/tasks", auth, async (req, res) => {
    try {
        const tasks = await Task.find({
            userId: req.session.userId
        }).sort({
            dueDate: 1
        });

        const taskObjects = tasks.map(task =>
            task.toObject()
        );

        res.json({
            tasks: taskObjects,
            streak: getStreak(taskObjects),
            today: dateKey()
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not load tasks"
        });
    }
});


// CREATE TASK
app.post("/api/tasks", auth, async (req, res) => {
    try {
        const { title, dueDate, repeat } = req.body;

        if (!title || !dueDate) {
            return res.status(400).json({
                message: "Task and due date are required"
            });
        }

        const task = await Task.create({
            id: Date.now().toString(),
            userId: req.session.userId,
            title: title.trim(),
            startDate: dueDate,
            dueDate,
            repeat: repeat || "none",
            completions: []
        });

        res.status(201).json(task.toObject());

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not create task"
        });
    }
});


// TOGGLE TASK
app.put("/api/tasks/:id/toggle", auth, async (req, res) => {
    try {
        const task = await Task.findOne({
            id: req.params.id,
            userId: req.session.userId
        });

        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        const today = dateKey();

        if (task.repeat === "none") {

            if (task.completions.includes(task.dueDate)) {
                task.completions =
                    task.completions.filter(
                        date => date !== task.dueDate
                    );
            } else {
                task.completions.push(task.dueDate);
            }

        } else {

            if (task.completions.includes(task.dueDate)) {

                task.completions =
                    task.completions.filter(
                        date => date !== task.dueDate
                    );

            } else {

                task.completions.push(task.dueDate);

                task.dueDate =
                    nextDate(
                        task.dueDate,
                        task.repeat
                    );
            }
        }

        await task.save();

        const userTasks = await Task.find({
            userId: req.session.userId
        });

        const taskObjects = userTasks.map(
            item => item.toObject()
        );

        res.json({
            task: task.toObject(),
            streak: getStreak(taskObjects),
            today
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not update task"
        });
    }
});


// DELETE TASK
app.delete("/api/tasks/:id", auth, async (req, res) => {
    try {
        const task = await Task.findOne({
            id: req.params.id,
            userId: req.session.userId
        });

        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        await Task.deleteOne({
            id: req.params.id,
            userId: req.session.userId
        });

        res.json({
            message: "Task deleted"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not delete task"
        });
    }
});


// Start server
app.listen(PORT, () => {
    console.log(
        `FocusFlow running at http://localhost:${PORT}`
    );
});