import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import HelpContent, {
  parseHelpSections,
  parseMarkdownBlocks,
} from '../components/help/HelpContent.jsx';

describe('HelpContent', () => {
  test('parse le mode emploi en titre, intro et sections numerotees', () => {
    const parsed = parseHelpSections(`# Mode emploi

Intro courte
Encore intro

## 1. Scenes
Créer une scene.

## Export
Publier le jeu.`);

    expect(parsed).toEqual({
      title: 'Mode emploi',
      intro: 'Intro courte\nEncore intro',
      sections: [
        {
          title: 'Scenes',
          content: ['Créer une scene.', ''],
        },
        {
          title: 'Export',
          content: ['Publier le jeu.'],
        },
      ],
    });
  });

  test('parse les blocs markdown utilises dans le panneau aide', () => {
    expect(parseMarkdownBlocks(`### Titre
Un paragraphe
sur deux lignes.

- Objet
- Indice

1. Tester
2. Publier

> Conseil`)).toEqual([
      { type: 'heading', text: 'Titre' },
      { type: 'paragraph', text: 'Un paragraphe sur deux lignes.' },
      { type: 'unordered', items: ['Objet', 'Indice'] },
      { type: 'ordered', items: ['Tester', 'Publier'] },
      { type: 'quote', text: 'Conseil' },
    ]);
  });

  test('rend les titres, listes, citations et emphases sans changer la structure visuelle', () => {
    render(
      <HelpContent markdown={`### **Créer**
Ajoute une **scene** jouable.

- Image
- Sortie

> Teste dans Preview`} />,
    );

    expect(screen.getByRole('heading', { name: 'Créer' }).tagName).toBe('H3');
    expect(screen.getByText('scene').tagName).toBe('STRONG');
    const list = screen.getByRole('list');
    expect(within(list).getByText('Image')).toBeTruthy();
    expect(within(list).getByText('Sortie')).toBeTruthy();
    expect(screen.getByText('Teste dans Preview').tagName).toBe('BLOCKQUOTE');
  });
});
