// Match web dashboard color system
export const colors = {
  bg: "#1c1c1c",
  bgElevated: "#242424",
  fg: "#E5E5E5",
  fgMuted: "rgba(255,255,255,0.4)",
  fgSubtle: "rgba(255,255,255,0.2)",
  border: "rgba(255,255,255,0.1)",
  borderStrong: "rgba(255,255,255,0.2)",
  accent: "#ffffff",
  danger: "#ff6b6b",
};

// Expo template components still expect a default Colors export with light/dark keys.
const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: "#2f95dc",
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: "#fff",
  },
};

export default Colors;
