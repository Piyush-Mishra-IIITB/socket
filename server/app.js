import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";

const app = express();
app.use(cors());

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const port = 3000;
const users = new Set();

io.on("connection", (socket) => {
  users.add(socket.id);
  console.log("socket id :", socket.id);

  io.emit("online_user", Array.from(users));

  socket.on("message", ({ id, msg }) => {
    console.log("to", id, "msg", msg);

    io.to(id).emit("receive-msg", {
      from: socket.id,
      msg
    });
  });

  socket.on("disconnect", () => {
    console.log("disconnect", socket.id);
    users.delete(socket.id);
    io.emit("online_user", Array.from(users));
  });
});

server.listen(port, () => {
  console.log("server is running");
});

app.get("/", (req, res) => {
  res.send("hii");
});