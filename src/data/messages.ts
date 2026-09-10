export interface ChatMessage {
  initials: string;
  name: string;
  time: string;
  text: string;
  mine?: boolean;
}

export interface Conversation {
  id: string;
  kind: "channel" | "dm";
  name: string;
  /** icon/avatar label: "#" for channels, initials for DMs */
  glyph: string;
  color: string;
  preview: string;
  unread: number;
  members?: string;
  messages: ChatMessage[];
}

export const conversations: Conversation[] = [
  {
    id: "design-team",
    kind: "channel",
    name: "design-team",
    glyph: "#",
    color: "#1F3C88",
    preview: "Jordan: pushed new tokens",
    unread: 2,
    members: "8 members",
    messages: [
      { initials: "JC", name: "Jordan Cole", time: "9:40 AM", text: "Pushed the new design tokens to the shared library 🎨", mine: true },
      { initials: "SJ", name: "Sarah Jenkins", time: "9:42 AM", text: "Nice, I can see them in Figma already." },
      { initials: "JC", name: "Jordan Cole", time: "9:45 AM", text: "Check #website-redesign for the usage example.", mine: true },
    ],
  },
  {
    id: "website-redesign",
    kind: "channel",
    name: "website-redesign",
    glyph: "#",
    color: "#1F3C88",
    preview: "Sarah: can we add annual toggle?",
    unread: 1,
    members: "12 members",
    messages: [
      { initials: "SJ", name: "Sarah Jenkins", time: "10:14 AM", text: "Can we add an annual billing toggle to the pricing page?" },
      { initials: "JC", name: "Jordan Cole", time: "10:22 AM", text: "Yep, adding it to the wireframe now 👍", mine: true },
      { initials: "SJ", name: "Sarah Jenkins", time: "10:23 AM", text: "Perfect, thank you!" },
    ],
  },
  {
    id: "announcements",
    kind: "channel",
    name: "announcements",
    glyph: "#",
    color: "#1F3C88",
    preview: "Pinned: Office closed Nov 28",
    unread: 0,
    members: "Company-wide",
    messages: [
      { initials: "HR", name: "People Ops", time: "Mon", text: "Office closed Nov 28 — Thanksgiving. NY & Austin offices closed." },
    ],
  },
  {
    id: "sarah",
    kind: "dm",
    name: "Sarah Jenkins",
    glyph: "SJ",
    color: "#2E86AB",
    preview: "Sounds good, thanks!",
    unread: 1,
    messages: [
      { initials: "JC", name: "Jordan Cole", time: "9:10 AM", text: "Sending over the homepage wireframe now.", mine: true },
      { initials: "SJ", name: "Sarah Jenkins", time: "9:12 AM", text: "Sounds good, thanks!" },
    ],
  },
  {
    id: "mike",
    kind: "dm",
    name: "Mike Chen",
    glyph: "MC",
    color: "#1F3C88",
    preview: "Approved your leave request",
    unread: 0,
    messages: [
      { initials: "MC", name: "Mike Chen", time: "Yesterday", text: "Approved your leave request." },
    ],
  },
  {
    id: "alex",
    kind: "dm",
    name: "Alex Rivera",
    glyph: "AR",
    color: "#1F3C88",
    preview: "Let's sync tomorrow",
    unread: 0,
    messages: [
      { initials: "AR", name: "Alex Rivera", time: "Yesterday", text: "Let's sync tomorrow about the Q4 campaign." },
    ],
  },
  {
    id: "ceo",
    kind: "dm",
    name: "CEO",
    glyph: "CE",
    color: "#1F3C88",
    preview: "",
    unread: 0,
    messages: [{ initials: "CE", name: "Priya Nair", time: "Mon", text: "Great work on the demo!" }],
  },
];

export const channelsHeader = ["design-team", "website-redesign", "announcements"];
