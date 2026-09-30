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
    if (repeat === "daily") {
        return addDays(dateString, 1);
    }

    if (repeat === "weekly") {
        return addDays(dateString, 7);
    }

    if (repeat === "biweekly") {
        return addDays(dateString, 14);
    }

    if (repeat === "monthly") {
        const d = new Date(dateString + "T00:00:00");
        const day = d.getDate();

        d.setMonth(d.getMonth() + 1);

        if (d.getDate() !== day) {
            d.setDate(0);
        }

        return dateKey(d);
    }

    return null;
}

function isDueOn(task, day) {
    const target = new Date(day + "T00:00:00");
    const start = new Date(task.startDate + "T00:00:00");

    if (target < start) {
        return false;
    }

    if (task.repeat === "none") {
        return task.startDate === day;
    }

    if (task.repeat === "daily") {
        return true;
    }

    const diff = Math.floor((target - start) / 86400000);

    if (task.repeat === "weekly") {
        return diff % 7 === 0;
    }

    if (task.repeat === "biweekly") {
        return diff % 14 === 0;
    }

    if (task.repeat === "monthly") {
        return (
            target.getDate() === start.getDate() ||
            (
                target.getMonth() !== start.getMonth() &&
                target.getDate() ===
                    new Date(
                        target.getFullYear(),
                        target.getMonth() + 1,
                        0
                    ).getDate() &&
                start.getDate() > target.getDate()
            )
        );
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
        const dueTasks = tasks.filter(task =>
            isDueOn(task, current)
        );

        if (dueTasks.length === 0) {
            break;
        }

        const allDone = dueTasks.every(task =>
            completedOn(task, current)
        );

        if (!allDone) {
            break;
        }

        streak++;
        current = addDays(current, -1);
    }

    return streak;
}

module.exports = {
    dateKey,
    addDays,
    nextDate,
    isDueOn,
    completedOn,
    getStreak
};