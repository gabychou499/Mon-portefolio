import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  const contentDir = path.join(process.cwd(), 'content', 'projets');
  if (!fs.existsSync(contentDir)) return [];
  
  const files = fs.readdirSync(contentDir);
  return files
    .filter(file => file.endsWith('.json'))
    .map(file => ({
      slug: file.replace('.json', '')
    }));
}

export default async function ProjetPage({ params }) {
  const { slug } = await params;
  
  const contentDir = path.join(process.cwd(), 'content', 'projets');
  const filePath = path.join(contentDir, `${slug}.json`);
  
  if (!fs.existsSync(filePath)) {
    notFound();
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const projet = JSON.parse(fileContent);

  return (
    <main style={{ minHeight: '100vh', padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '4rem' }} className="animate-fade-in">
        <Link href="/projets" style={{ display: 'inline-block', marginBottom: '2rem', color: 'var(--accent-color)' }}>
          &larr; cd ../ (Retour aux projets)
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '2.5rem' }}>📄</div>
          <h1 className="text-gradient" style={{ fontSize: '3.5rem', lineHeight: '1.2' }}>{projet.title}</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          <span>📅 Date: {projet.date}</span>
          <span>•</span>
          <span style={{ display: 'flex', gap: '0.5rem' }}>
            🏷️ {projet.tags?.map(tag => (
              <span key={tag} style={{ color: 'var(--accent-color)' }}>#{tag}</span>
            ))}
          </span>
        </div>
        
        <p style={{ fontSize: '1.2rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          {projet.description}
        </p>
      </header>

      <article className="glass-panel animate-fade-in" style={{ padding: '3rem', animationDelay: '0.2s' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
          Contenu du fichier
        </h2>
        
        <div style={{ lineHeight: '1.8', fontSize: '1.1rem', whiteSpace: 'pre-line' }}>
          {projet.content}
        </div>
      </article>
      
      <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        <p>Fin du fichier {slug}.json</p>
      </footer>
    </main>
  );
}
