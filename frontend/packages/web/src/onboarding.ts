type TeamMember = {
  email: string;
  role: string;
  status: string;
  invitedAt?: string;
};

type PlayerProfile = {
  displayName?: string;
  avatar?: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string;
  team: {
    id: string;
    name: string;
    avatar?: string;
    members?: TeamMember[];
  };
};

function qs<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

const form = qs<HTMLFormElement>("onboardingForm");
const displayNameInput = qs<HTMLInputElement>("profileDisplayName");
const avatarInput = qs<HTMLInputElement>("profileAvatar");
const teamNameInput = qs<HTMLInputElement>("teamName");
const teamAvatarInput = qs<HTMLInputElement>("teamAvatar");
const invitesInput = qs<HTMLTextAreaElement>("teamInvites");
const skipInvitesBtn = qs<HTMLButtonElement>("onboardingSkipInvites");
const statusEl = qs<HTMLDivElement>("onboardingStatus");
const saveBtn = qs<HTMLButtonElement>("onboardingSave");

function setStatus(msg: string, isError = false): void {
  statusEl.textContent = msg;
  statusEl.classList.toggle("text-red-400", isError);
  statusEl.classList.toggle("text-muted-foreground", !isError);
}

async function apiProfile(): Promise<PlayerProfile> {
  const res = await fetch("/api/player/profile");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `GET /api/player/profile failed: ${res.status}`);
  return data.profile as PlayerProfile;
}

async function apiComplete(payload: { displayName: string; avatar: string; teamName: string; teamAvatar: string }): Promise<PlayerProfile> {
  const res = await fetch("/api/player/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || `POST /api/player/onboarding/complete failed: ${res.status}`);
  return data.profile as PlayerProfile;
}

async function apiInvite(email: string): Promise<void> {
  const res = await fetch("/api/player/team/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || `POST /api/player/team/invite failed: ${res.status}`);
}

function parseInviteEmails(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]/g)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of parts) {
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

function fillProfile(profile: PlayerProfile): void {
  displayNameInput.value = profile.displayName ?? "";
  avatarInput.value = profile.avatar ?? "";
  teamNameInput.value = profile.team?.name ?? "";
  teamAvatarInput.value = profile.team?.avatar ?? "";
}

async function submit(includeInvites: boolean): Promise<void> {
  const payload = {
    displayName: displayNameInput.value.trim(),
    avatar: avatarInput.value.trim(),
    teamName: teamNameInput.value.trim(),
    teamAvatar: teamAvatarInput.value.trim(),
  };

  saveBtn.disabled = true;
  skipInvitesBtn.disabled = true;

  try {
    setStatus("Saving onboarding...");
    await apiComplete(payload);

    if (includeInvites) {
      const invites = parseInviteEmails(invitesInput.value);
      for (const email of invites) {
        await apiInvite(email);
      }
      if (invites.length > 0) {
        setStatus(`Setup complete. ${invites.length} invite(s) queued. Redirecting...`);
      } else {
        setStatus("Setup complete. Redirecting...");
      }
    } else {
      setStatus("Setup complete. Redirecting...");
    }

    window.location.href = "/tasks";
  } catch (err: any) {
    setStatus(String(err?.message ?? err), true);
    saveBtn.disabled = false;
    skipInvitesBtn.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  void submit(true);
});

skipInvitesBtn.addEventListener("click", () => {
  void submit(false);
});

void apiProfile()
  .then((profile) => {
    if (profile.onboardingCompleted) {
      window.location.href = "/tasks";
      return;
    }
    fillProfile(profile);
  })
  .catch((err: any) => {
    setStatus(String(err?.message ?? err), true);
  });
