"use client";

import { useSettings, ColorTheme, CardSize, AnimationLevel } from "@/lib/settings";
import styles from "./SettingsModal.module.css";

interface Props { onClose: () => void; }

const THEMES: { value: ColorTheme; label: string; preview: string }[] = [
  { value: "dark_gold",    label: "Gold",     preview: "#c9923a" },
  { value: "dark_crimson", label: "Crimson",  preview: "#c93a3a" },
  { value: "dark_forest",  label: "Forest",   preview: "#3a9a5c" },
  { value: "midnight",     label: "Midnight", preview: "#5a7adf" },
];

const CARD_SIZES: { value: CardSize; label: string; desc: string }[] = [
  { value: "small",  label: "Small",  desc: "More cards visible" },
  { value: "medium", label: "Medium", desc: "Default" },
  { value: "large",  label: "Large",  desc: "Easier to read" },
];

const ANIMATION_LEVELS: { value: AnimationLevel; label: string; desc: string }[] = [
  { value: "full",    label: "Full",    desc: "All animations & effects" },
  { value: "reduced", label: "Reduced", desc: "Subtle animations only" },
  { value: "minimal", label: "Minimal", desc: "No animations" },
];

export default function SettingsModal({ onClose }: Props) {
  const { settings, updateSetting } = useSettings();

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <span className={styles.cornerTl}>♠</span>
        <span className={styles.cornerBr}>♦</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
        <h2 className={styles.title}>Settings</h2>
        <div className={styles.titleDivider} />

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>♦ Color Theme</h3>
          <div className={styles.themeGrid}>
            {THEMES.map(theme => (
              <button
                key={theme.value}
                className={`${styles.themeBtn} ${settings.colorTheme === theme.value ? styles.themeBtnActive : ""}`}
                onClick={() => updateSetting("colorTheme", theme.value)}
              >
                <div className={styles.themePreview} style={{ background: theme.preview }} />
                <span className={styles.themeBtnLabel}>{theme.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>♣ Card Size</h3>
          <div className={styles.optionRow}>
            {CARD_SIZES.map(size => (
              <button
                key={size.value}
                className={`${styles.optionBtn} ${settings.cardSize === size.value ? styles.optionBtnActive : ""}`}
                onClick={() => updateSetting("cardSize", size.value)}
              >
                <span className={styles.optionLabel}>{size.label}</span>
                <span className={styles.optionDesc}>{size.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>✦ Animations</h3>
          <div className={styles.optionRow}>
            {ANIMATION_LEVELS.map(level => (
              <button
                key={level.value}
                className={`${styles.optionBtn} ${settings.animationLevel === level.value ? styles.optionBtnActive : ""}`}
                onClick={() => updateSetting("animationLevel", level.value)}
              >
                <span className={styles.optionLabel}>{level.label}</span>
                <span className={styles.optionDesc}>{level.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>♪ Audio <span className={styles.comingSoon}>Coming Soon</span></h3>
          <div className={styles.sliderRow}>
            <label className={styles.sliderLabel}>Music</label>
            <input type="range" min={0} max={100} value={settings.musicVolume}
              onChange={e => updateSetting("musicVolume", Number(e.target.value))}
              className={styles.slider} disabled />
            <span className={styles.sliderValue}>{settings.musicVolume}%</span>
          </div>
          <div className={styles.sliderRow}>
            <label className={styles.sliderLabel}>SFX</label>
            <input type="range" min={0} max={100} value={settings.sfxVolume}
              onChange={e => updateSetting("sfxVolume", Number(e.target.value))}
              className={styles.slider} disabled />
            <span className={styles.sliderValue}>{settings.sfxVolume}%</span>
          </div>
        </section>
      </div>
    </div>
  );
}
