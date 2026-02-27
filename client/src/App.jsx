import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

function App() {
  const socket = useMemo(() => io("http://localhost:3000"), []);

  const [msg, setMsg] = useState("");
  const [targetId, setTargetId] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);

  // socket listeners
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected:", socket.id);
    });

    socket.on("online_user", (users) => {
      setOnlineUsers(users);
    });

    socket.on("receive-msg", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off("connect");
      socket.off("online_user");
      socket.off("receive-msg");
    };
  }, [socket]);

  // send message
  const sendMessage = (e) => {
    e.preventDefault();
    if (!msg || !targetId) return;

    socket.emit("message", { id: targetId, msg });

    // also show own message in UI
    setMessages((prev) => [
      ...prev,
      { from: socket.id, msg }
    ]);

    setMsg("");
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>Your ID: {socket.id}</h2>

      {/* ONLINE USERS */}
      <h3>Online Users</h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {onlineUsers
          .filter((id) => id !== socket.id)
          .map((id) => (
            <button
              key={id}
              onClick={() => setTargetId(id)}
              style={{
                padding: "6px 12px",
                background: targetId === id ? "#4caf50" : "#ddd",
                border: "none",
                cursor: "pointer"
              }}
            >
              {id}
            </button>
          ))}
      </div>

      {/* CHAT BOX */}
      <h3>Chat</h3>
      <div
        style={{
          height: 200,
          border: "1px solid gray",
          marginBottom: 10,
          padding: 10,
          overflowY: "auto"
        }}
      >
        {messages.map((m, i) => (
          <div key={i}>
            <b>{m.from === socket.id ? "Me" : m.from}:</b> {m.msg}
          </div>
        ))}
      </div>

      {/* INPUT */}
      <form onSubmit={sendMessage}>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Type message..."
          style={{ padding: 8, width: 200 }}
        />
        <button style={{ marginLeft: 10 }}>Send</button>
      </form>
    </div>
  );
}

export default App;