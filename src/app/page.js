import Link from 'next/link';
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={`${styles.header} animate-fade-in`}>
        <h1 className={`${styles.title} text-gradient`}>Développeur Senior</h1>
        <p className={styles.subtitle}>
          Bienvenue dans mon espace numérique. Explorez mes projets comme vous le feriez sur un système de fichiers, mais avec une esthétique premium.
        </p>
      </header>

      <div className={styles.bentoGrid}>
        {/* Profil principal */}
        <div className={`glass-panel ${styles.bentoItem} ${styles.profile} animate-fade-in`} style={{animationDelay: '0.1s'}}>
          <div className={styles.bentoContent}>
            <div className={styles.folderIcon}>👋</div>
            <h2 className={styles.itemTitle}>À propos de moi</h2>
            <p className={styles.itemDesc} style={{marginTop: '1rem', lineHeight: '1.6', fontSize: '1.1rem'}}>
              Je conçois et développe des architectures web robustes, esthétiques et hautement performantes. 
              J'aime transformer la complexité en interfaces fluides et intuitives.
            </p>
          </div>
        </div>

        {/* Dossier Projets */}
        <Link href="/projets" className={`glass-panel ${styles.bentoItem} ${styles.projectsFolder} animate-fade-in`} style={{animationDelay: '0.2s'}}>
          <div className={styles.bentoContent}>
            <div className={styles.folderIcon}>📁</div>
            <h2 className={styles.itemTitle}>/projets</h2>
            <p className={styles.itemDesc}>Ouvrir le dossier des réalisations (Système de fichiers dynamique)</p>
          </div>
        </Link>

        {/* Dossier Compétences */}
        <div className={`glass-panel ${styles.bentoItem} ${styles.skills} animate-fade-in`} style={{animationDelay: '0.3s'}}>
          <div className={styles.bentoContent}>
            <div className={styles.folderIcon}>🛠️</div>
            <h2 className={styles.itemTitle}>/stack.json</h2>
            <p className={styles.itemDesc}>{"{ react, nextjs, nodejs, architecture }"}</p>
          </div>
        </div>

        {/* Contact */}
        <a href="mailto:contact@example.com" className={`glass-panel ${styles.bentoItem} ${styles.contact} animate-fade-in`} style={{animationDelay: '0.4s'}}>
          <div className={styles.bentoContent}>
            <h2 className={styles.itemTitle}>➔ init.contact()</h2>
          </div>
        </a>
      </div>
    </main>
  );
}
