import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const users = new Map(); // socketId -> socket

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  users.set(socket.id, socket);
  io.emit("online-users", Array.from(users.keys()));

  // CALL USER
  socket.on("call-user", ({ to, offer }) => {
    io.to(to).emit("incoming-call", { from: socket.id, offer });
  });

  // ANSWER CALL
  socket.on("answer-call", ({ to, answer }) => {
    io.to(to).emit("call-answered", { from: socket.id, answer });
  });

  // ICE CANDIDATE
  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });
socket.on("reject-call", ({ to }) => {
  io.to(to).emit("call-rejected");
});
socket.on("hangup", ({ to }) => {
  io.to(to).emit("hangup");
});
  socket.on("disconnect", () => {
    users.delete(socket.id);
    io.emit("online-users", Array.from(users.keys()));
  });
});

httpServer.listen(3000, () => console.log("Server running"));