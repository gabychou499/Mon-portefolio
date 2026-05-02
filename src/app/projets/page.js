import fs from 'fs';
import path from 'path';
import Link from 'next/link';

export default async function ProjetsPage() {
  const contentDir = path.join(process.cwd(), 'content', 'projets');
  let projets = [];
  
  try {
    const files = fs.readdirSync(contentDir);
    projets = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(contentDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        return {
          slug: file.replace('.json', ''),
          ...data
        };
      });
  } catch (e) {
    console.error("Erreur lors de la lecture des projets:", e);
  }

  return (
    <main style={{ minHeight: '100vh', padding: '4rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: '2rem', color: 'var(--accent-color)' }}>
          &larr; cd .. (Retour à l'accueil)
        </Link>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '1rem' }}>/projets</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {projets.length} élément(s) trouvé(s) dans le répertoire.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
        {projets.map((projet, idx) => (
          <Link href={`/projets/${projet.slug}`} key={projet.slug} className="glass-panel" style={{ padding: '2rem', display: 'block', textDecoration: 'none', animationDelay: `${idx * 0.1}s` }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📄</div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{projet.title}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {projet.description}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {projet.tags?.map(tag => (
                <span key={tag} style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-color)', padding: '0.2rem 0.6rem', borderRadius: '100px', fontSize: '0.8rem' }}>
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
        
        {/* Helper Card */}
        <div className="glass-panel" style={{ padding: '2rem', borderStyle: 'dashed', borderColor: 'var(--text-secondary)', opacity: 0.7 }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>+</div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Ajouter un projet</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Créez un fichier <code>.json</code> dans le dossier <code>content/projets/</code>.
          </p>
        </div>
      </div>
    </main>
  );
}
