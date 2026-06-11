import { useEffect, useState } from "react";

type MultiplayerLobbyProps = {
  inviteUrl: string;
  isHost: boolean;
  players: Array<{
    id: string;
    isYou?: boolean;
    name: string;
  }>;
  roomId: string;
  onStart: () => void;
  onExit: () => void;
};

export function MultiplayerLobby({
  inviteUrl,
  isHost,
  players,
  roomId,
  onStart,
  onExit,
}: MultiplayerLobbyProps) {
  const [hasCopiedInvite, setHasCopiedInvite] = useState(false);

  useEffect(() => {
    if (!hasCopiedInvite) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setHasCopiedInvite(false), 2000);

    return () => window.clearTimeout(timeoutId);
  }, [hasCopiedInvite]);

  async function copyInviteUrl() {
    await copyText(inviteUrl);
    setHasCopiedInvite(true);
  }

  return (
    <section className="multiplayer-screen">
      <div className="multiplayer-panel">
        <p className="eyebrow">Multiplayer lobby</p>
        <h1>Room {roomId}</h1>
        <p>Share this link and start when everyone has joined.</p>

        <div className="invite-box">
          <button
            className="invite-url-field"
            aria-label="Copy invite link"
            type="button"
            onClick={() => {
              void copyInviteUrl();
            }}
          >
            <span>{inviteUrl}</span>
          </button>
          <button
            className={hasCopiedInvite ? "invite-copy-button is-copied" : "invite-copy-button"}
            type="button"
            aria-label={hasCopiedInvite ? "Invite link copied" : "Copy invite link"}
            title={hasCopiedInvite ? "Copied" : "Copy invite link"}
            onClick={() => {
              void copyInviteUrl();
            }}
          >
            {hasCopiedInvite ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>

        <div className="lobby-player-list">
          {players.map((player) => (
            <div key={player.id}>
              <strong>
                {player.name}
                {player.isYou ? " (You)" : ""}
              </strong>
            </div>
          ))}
        </div>

        <div className="final-actions">
          {isHost ? (
            <button className="primary-action" type="button" onClick={onStart}>
              Start round
            </button>
          ) : (
            <span className="waiting-label">Waiting for host</span>
          )}
          <button className="secondary-action" type="button" onClick={onExit}>
            Leave
          </button>
        </div>
      </div>
    </section>
  );
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");

  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="8" y="8" width="10" height="10" rx="2"></rect>
      <path d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"></path>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 13 4 4L19 7"></path>
    </svg>
  );
}
