const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
const PORT = 3000;

const dataDir = path.join(__dirname, "data");
const usersFile = path.join(dataDir, "users.json");
const tasksFile = path.join(dataDir, "tasks.json");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, "[]");
if (!fs.existsSync(tasksFile)) fs.writeFileSync(tasksFile, "[]");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
    secret: "todo-student-project-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

function read(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function write(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function auth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Please sign in" });
    }
    next();
}

function dateKey(date = new Date()) {
    const d = new Date(date);
    return d.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
    const d = new Date(dateString + "T00:00:00");
    d.setDate(d.getDate() + days);
    return dateKey(d);
}

function nextDate(dateString, repeat) {
    if (repeat === "daily") return addDays(dateString, 1);
    if (repeat === "weekly") return addDays(dateString, 7);
    if (repeat === "biweekly") return addDays(dateString, 14);

    if (repeat === "monthly") {
        const d = new Date(dateString + "T00:00:00");
        const day = d.getDate();
        d.setMonth(d.getMonth() + 1);

        if (d.getDate() !== day) d.setDate(0);

        return dateKey(d);
    }

    return null;
}

function isDueOn(task, day) {
    const target = new Date(day + "T00:00:00");
    const start = new Date(task.startDate + "T00:00:00");

    if (target < start) return false;

    if (task.repeat === "none") {
        return task.startDate === day;
    }

    if (task.repeat === "daily") return true;

    const diff = Math.floor((target - start) / 86400000);

    if (task.repeat === "weekly") return diff % 7 === 0;
    if (task.repeat === "biweekly") return diff % 14 === 0;

    if (task.repeat === "monthly") {
        return target.getDate() === start.getDate() ||
            (target.getMonth() !== start.getMonth() && target.getDate() === new Date(
                target.getFullYear(),
                target.getMonth() + 1,
                0
            ).getDate() && start.getDate() > target.getDate());
    }

    return false;
}

function completedOn(task, day) {
    return task.completions && task.completions.includes(day);
}

function getStreak(tasks) {
    const today = dateKey();
    let streak = 0;
    let current = today;

    for (let i = 0; i < 1000; i++) {
        const dueTasks = tasks.filter(task => isDueOn(task, current));

        if (dueTasks.length === 0) break;

        const allDone = dueTasks.every(task => completedOn(task, current));

        if (!allDone) break;

        streak++;
        current = addDays(current, -1);
    }

    return streak;
}

app.post("/api/signup", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const users = read(usersFile);
    const exists = users.find(user => user.email.toLowerCase() === email.toLowerCase());

    if (exists) {
        return res.status(400).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
        id: Date.now().toString(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash
    };

    users.push(user);
    write(usersFile, users);

    req.session.userId = user.id;

    res.json({
        id: user.id,
        name: user.name,
        email: user.email
    });
});

app.post("/api/signin", async (req, res) => {
    const { email, password } = req.body;

    const users = read(usersFile);
    const user = users.find(item => item.email === email.toLowerCase().trim());

    if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    req.session.userId = user.id;

    res.json({
        id: user.id,
        name: user.name,
        email: user.email
    });
});

app.post("/api/logout", auth, (req, res) => {
    req.session.destroy(() => {
        res.json({ message: "Logged out" });
    });
});

app.get("/api/me", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Not signed in" });
    }

    const users = read(usersFile);
    const user = users.find(item => item.id === req.session.userId);

    if (!user) {
        return res.status(401).json({ message: "User not found" });
    }

    res.json({
        id: user.id,
        name: user.name,
        email: user.email
    });
});

app.get("/api/tasks", auth, (req, res) => {
    const tasks = read(tasksFile)
        .filter(task => task.userId === req.session.userId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    res.json({
        tasks,
        streak: getStreak(tasks),
        today: dateKey()
    });
});

app.post("/api/tasks", auth, (req, res) => {
    const { title, dueDate, repeat } = req.body;

    if (!title || !dueDate) {
        return res.status(400).json({ message: "Task and due date are required" });
    }

    const tasks = read(tasksFile);

    const task = {
        id: Date.now().toString(),
        userId: req.session.userId,
        title: title.trim(),
        startDate: dueDate,
        dueDate,
        repeat: repeat || "none",
        completions: []
    };

    tasks.push(task);
    write(tasksFile, tasks);

    res.status(201).json(task);
});

app.put("/api/tasks/:id/toggle", auth, (req, res) => {
    const tasks = read(tasksFile);
    const task = tasks.find(
        item => item.id === req.params.id && item.userId === req.session.userId
    );

    if (!task) {
        return res.status(404).json({ message: "Task not found" });
    }

    const today = dateKey();
    const index = task.completions.indexOf(task.dueDate);

    if (task.repeat === "none") {
        if (task.completions.includes(task.dueDate)) {
            task.completions = task.completions.filter(date => date !== task.dueDate);
        } else {
            task.completions.push(task.dueDate);
        }
    } else {
        if (task.completions.includes(task.dueDate)) {
            task.completions = task.completions.filter(date => date !== task.dueDate);
        } else {
            task.completions.push(task.dueDate);
            task.dueDate = nextDate(task.dueDate, task.repeat);
        }
    }

    write(tasksFile, tasks);

    const userTasks = tasks.filter(item => item.userId === req.session.userId);

    res.json({
        task,
        streak: getStreak(userTasks),
        today
    });
});

app.delete("/api/tasks/:id", auth, (req, res) => {
    let tasks = read(tasksFile);

    const exists = tasks.some(
        item => item.id === req.params.id && item.userId === req.session.userId
    );

    if (!exists) {
        return res.status(404).json({ message: "Task not found" });
    }

    tasks = tasks.filter(
        item => !(item.id === req.params.id && item.userId === req.session.userId)
    );

    write(tasksFile, tasks);

    res.json({ message: "Task deleted" });
});

app.listen(PORT, () => {
    console.log(`Todo app running at http://localhost:${PORT}`);
});
