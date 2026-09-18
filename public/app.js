const authPage = document.getElementById("authPage");
const appPage = document.getElementById("appPage");

const signinTab = document.getElementById("signinTab");
const signupTab = document.getElementById("signupTab");
const nameBox = document.getElementById("nameBox");
const authButton = document.getElementById("authButton");
const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");

const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const streak = document.getElementById("streak");
const taskCount = document.getElementById("taskCount");
const welcome = document.getElementById("welcome");

let signupMode = false;
let currentFilter = "all";

const today = new Date().toISOString().slice(0, 10);

document.getElementById("dueDate").value = today;


signinTab.addEventListener("click", () => {
    signupMode = false;

    signinTab.className = "auth-tab active";
    signupTab.className = "auth-tab";

    nameBox.classList.add("hidden");

    authButton.textContent = "Sign In";
    authMessage.textContent = "";
});


signupTab.addEventListener("click", () => {
    signupMode = true;

    signupTab.className = "auth-tab active";
    signinTab.className = "auth-tab";

    nameBox.classList.remove("hidden");

    authButton.textContent = "Create Account";
    authMessage.textContent = "";
});


authForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
        name: document.getElementById("name").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
    };

    const url = signupMode ? "/api/signup" : "/api/signin";

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            authMessage.textContent = result.message;
            return;
        }

        showApp(result);

    } catch {
        authMessage.textContent = "Something went wrong";
    }
});


async function checkLogin() {
    try {
        const response = await fetch("/api/me");

        if (!response.ok) {
            showAuth();
            return;
        }

        const user = await response.json();

        showApp(user);

    } catch {
        showAuth();
    }
}


function showApp(user) {
    authPage.classList.add("hidden");
    appPage.classList.remove("hidden");

    welcome.textContent = `Hi, ${user.name}`;

    loadTasks();
}


function showAuth() {
    authPage.classList.remove("hidden");
    appPage.classList.add("hidden");
}


taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("taskTitle").value;
    const dueDate = document.getElementById("dueDate").value;
    const repeat = document.getElementById("repeat").value;

    try {
        const response = await fetch("/api/tasks", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title,
                dueDate,
                repeat
            })
        });

        if (response.ok) {
            taskForm.reset();

            document.getElementById("dueDate").value = today;

            loadTasks();
        }

    } catch {
        console.log("Could not add task");
    }
});


async function loadTasks() {
    try {
        const response = await fetch("/api/tasks");

        if (!response.ok) {
            showAuth();
            return;
        }

        const data = await response.json();

        streak.textContent = data.streak;

        renderTasks(data.tasks);

    } catch {
        showAuth();
    }
}


function renderTasks(tasks) {

    taskList.innerHTML = "";

    let filteredTasks = tasks;

    if (currentFilter === "pending") {
        filteredTasks = tasks.filter(task => {
            return !task.completions.includes(task.dueDate);
        });
    }

    if (currentFilter === "completed") {
        filteredTasks = tasks.filter(task => {
            return task.completions.includes(task.dueDate);
        });
    }

    taskCount.textContent =
        `${filteredTasks.length} ${filteredTasks.length === 1 ? "task" : "tasks"}`;


    if (filteredTasks.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");


    filteredTasks.forEach(task => {

        const done = task.completions.includes(task.dueDate);

        const item = document.createElement("div");

        item.className =
            "task-item";


        item.innerHTML = `

            <div class="task-left">

                <button
                    onclick="toggleTask('${task.id}')"
                    class="task-check ${done ? "completed" : ""}"
                >
                    ${done ? "✓" : ""}
                </button>


                <div class="min-w-0">

                    <h3 class="task-title ${done ? "completed" : ""}">
                        ${escapeHtml(task.title)}
                    </h3>


                    <div class="task-info">

                        <span>
                            Due ${formatDate(task.dueDate)}
                        </span>

                        ${task.repeat !== "none" ? `

                            <span>
                                · ${repeatText(task.repeat)}
                            </span>

                        ` : ""}

                    </div>

                </div>

            </div>


            <button
                onclick="deleteTask('${task.id}')"
                class="delete-btn"
            >
                Delete
            </button>

        `;

        taskList.appendChild(item);
    });
}


function changeFilter(filter) {

    currentFilter = filter;

    document.querySelectorAll(".filter-btn").forEach(button => {
        button.classList.remove("active");
    });

    const selectedButton =
        document.querySelector(`[data-filter="${filter}"]`);

    if (selectedButton) {
        selectedButton.classList.add("active");
    }

    loadTasks();
}


async function toggleTask(id) {

    try {

        await fetch(`/api/tasks/${id}/toggle`, {
            method: "PUT"
        });

        loadTasks();

    } catch {
        console.log("Could not update task");
    }
}


async function deleteTask(id) {

    if (!confirm("Delete this task?")) {
        return;
    }

    try {

        await fetch(`/api/tasks/${id}`, {
            method: "DELETE"
        });

        loadTasks();

    } catch {
        console.log("Could not delete task");
    }
}


document.getElementById("logoutBtn").addEventListener("click", async () => {

    await fetch("/api/logout", {
        method: "POST"
    });

    showAuth();
});


function formatDate(date) {

    return new Date(date + "T00:00:00").toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


function repeatText(value) {

    if (value === "daily") {
        return "Daily";
    }

    if (value === "weekly") {
        return "Weekly";
    }

    if (value === "biweekly") {
        return "Every 2 weeks";
    }

    if (value === "monthly") {
        return "Monthly";
    }

    return "";
}


function escapeHtml(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


checkLogin();