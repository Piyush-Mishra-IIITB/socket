import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function App() {

  const socket = useMemo(() => io("http://localhost:3000"), []);

  const [users, setUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callingTo, setCallingTo] = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState("");

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);
  const localStream = useRef(null);

  /* ---------------- CAMERA ---------------- */

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localStream.current = stream;
    localVideo.current.srcObject = stream;
  };

  /* ---------------- PEER CONNECTION ---------------- */

  const createPeer = (targetId) => {

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    // send tracks
    localStream.current.getTracks().forEach(track => {
      peer.addTrack(track, localStream.current);
    });

    // receive tracks
    peer.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    // ICE exchange
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: targetId,
          candidate: event.candidate
        });
      }
    };

    // connection state
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setCallActive(true);
        setCallStatus("");
      }

      if (
        peer.connectionState === "disconnected" ||
        peer.connectionState === "closed" ||
        peer.connectionState === "failed"
      ) {
        endConnection();
      }
    };

    peerRef.current = peer;
    return peer;
  };

  /* ---------------- CALL USER ---------------- */

  const callUser = async (id) => {
    if (!localStream.current) {
      alert("Start camera first");
      return;
    }

    setCallStatus("");
    setCallingTo(id);

    const peer = createPeer(id);

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("call-user", { to: id, offer });
  };

  /* ---------------- ACCEPT CALL ---------------- */

  const acceptCall = async () => {
    const { from, offer } = incomingCall;

    // ensure camera
    if (!localStream.current) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStream.current = stream;
      localVideo.current.srcObject = stream;
    }

    setIncomingCall(null);
    setCallStatus("");

    const peer = createPeer(from);

    await peer.setRemoteDescription(offer);

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("answer-call", { to: from, answer });
  };

  /* ---------------- REJECT ---------------- */

  const rejectCall = () => {
    socket.emit("reject-call", { to: incomingCall.from });
    setIncomingCall(null);
  };

  /* ---------------- CLEANUP ---------------- */

  const endConnection = () => {

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }

    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;

    setCallActive(false);
    setCallingTo(null);
    setIncomingCall(null);
  };

  /* ---------------- HANGUP ---------------- */

  const hangup = () => {
    const other = callingTo || incomingCall?.from;

    if (other) socket.emit("hangup", { to: other });

    setCallStatus("You ended the call");
    endConnection();
  };

  /* ---------------- SOCKET EVENTS ---------------- */

  useEffect(() => {

    socket.on("online-users", setUsers);

    socket.on("incoming-call", ({ from, offer }) => {
      setIncomingCall({ from, offer });
    });

    socket.on("call-answered", async ({ answer }) => {
      await peerRef.current.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        await peerRef.current.addIceCandidate(candidate);
      } catch {}
    });

    socket.on("call-rejected", () => {
      alert("User rejected the call");
      setCallingTo(null);
    });

    socket.on("hangup", () => {
      setCallStatus("Call ended by other user");
      endConnection();
    });

    return () => socket.disconnect();

  }, []);

  /* ---------------- UI ---------------- */

  return (
    <div style={{ padding: 20 }}>

      <h2>My ID: {socket.id}</h2>

      <button onClick={startCamera}>Start Camera</button>

      <h3>Online Users</h3>
      {users.filter(u => u !== socket.id).map(u => (
        <div key={u}>
          {u}
          <button onClick={() => callUser(u)} style={{ marginLeft: 10 }}>
            Call
          </button>
        </div>
      ))}

      {callingTo && <h3>Calling {callingTo}...</h3>}

      {/* INCOMING POPUP */}
      {incomingCall && (
        <div style={{
          position: "fixed",
          top: 20,
          right: 20,
          background: "#222",
          color: "white",
          padding: 20,
          borderRadius: 12
        }}>
          <h3>Incoming Call</h3>
          <p>{incomingCall.from} is calling...</p>

          <button
            onClick={acceptCall}
            style={{ background: "green", color: "white", marginRight: 10 }}
          >
            Accept
          </button>

          <button
            onClick={rejectCall}
            style={{ background: "red", color: "white" }}
          >
            Reject
          </button>
        </div>
      )}

      <hr />

      {callStatus && <h3 style={{ color: "red" }}>{callStatus}</h3>}

      <h3>Local Video</h3>
      <video ref={localVideo} autoPlay muted playsInline width="300" />

      <h3>Remote Video</h3>
      <video ref={remoteVideo} autoPlay playsInline width="300" />

      {callActive && (
        <button
          onClick={hangup}
          style={{
            marginTop: 20,
            background: "black",
            color: "white",
            padding: 10
          }}
        >
          End Call
        </button>
      )}

    </div>
  );
}