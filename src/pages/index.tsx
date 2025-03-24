import React from 'react';
import styles from '../styles/Home.module.css';
import Header from '../components/Header';

export default function Home() {
  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <span className="text-blue-600">Imager</span>
        </h1>
        <p className={styles.description}>
          A web-based image editing tool with real-time effects
        </p>
        <p className="text-center mt-8">
          Coming soon! We're working on finalizing the application.
        </p>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://github.com/pauljunbear/imager2"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </footer>
    </div>
  );
} 