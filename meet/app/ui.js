function addChat(data) {
    const box = document.getElementById("chatBox");
    const div = document.createElement("div");
    div.innerText = data.user + ": " + data.msg;
    box.appendChild(div);
}

function updateUsers(users) {
    const list = document.getElementById("users");
    list.innerHTML = "";
    users.forEach(u => {
        const li = document.createElement("li");
        li.innerText = u;
        list.appendChild(li);
    });
}
