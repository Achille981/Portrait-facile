# Rapport de recherche synthétique

## Objectifs fonctionnels

- Importer une photo de référence et garder le traitement local.
- Superposer des guides de construction simples et hiérarchisés.
- Permettre un premier parcours utilisateur: importer, analyser, ajuster, grille, exporter.
- Proposer un produit premium, responsive et installable.

## Défis techniques

- Le visage réel est variable: profil, 3/4, lunettes, occlusion, faible luminosité, cheveux, faible résolution.
- L'outil ne doit pas masquer l'incertitude: détection, estimation, correction manuelle doivent rester distincts.
- Le moteur graphique doit rester fluide à l'écran et pendant l'export.
- Les performances doivent supporter desktop et mobile moyens.

## Solutions comparées

### Vision
- MediaPipe Face Landmarker: forte intégration Web, maintenu, bon niveau de maturité, utile pour landmarks et pose; important pour un prototype fiable.
- Précision plus élevée potentielle via modèles plus lourds ou backend; mais plus coûteux et moins simple à remplacer.
- Recommandation: abstraction par `VisionProvider` et traitement local par défaut.

### Moteur graphique
- Canvas 2D natif: minimal, performant, parfait pour export à partir de la scène; manque de gestion avancée d'objets si l'éditeur grandit.
- Konva: très bon pour calques, événements, zoom, transformations; plus intéressant si l'édition devient plus riche.
- Recommandation pour le vertical slice: Canvas 2D, avec une architecture prête pour une évolution vers Konva si nécessaire.

### Stockage local
- IndexedDB: standard web, adapté aux projets et à l'historique; meilleur compromis pour nous.
- LocalStorage: trop limité pour les gros projets et les données structurées.

### PWA
- Manifest + service worker + cache: solution standard et sûre pour installation et offline.

## Sources principales

- Next.js — Progressive Web Application guide
- MediaPipe Face Landmarker Web guide
- Konva overview
- MDN IndexedDB API
- MDN HTMLCanvasElement.toBlob

## Stack recommandée

- React + TypeScript + Vite
- Canvas 2D natif pour le rendu immédiat
- IndexedDB pour les projets locaux
- MediaPipe Face Landmarker via un provider abstrait
- Manifest + service worker pour la PWA

## Architecture proposée

- UI: écran d'accueil, panneau latéral, canvas, export.
- Domain: guides, grille, projet, historique.
- Vision: provider local + fallback manuel.
- Rendering: canvas + layer abstraction, séparation de la logique de dessin.
- Export: PNG ciblé, préparation pour JPG/PDF plus tard.

## Stratégie de développement

1. Base de l'interface et canvas.
2. Import du fichier et visualisation de la photo.
3. Grille + repères hiérarchisés.
4. Correction manuelle et zoom.
5. Export PNG.
6. Stockage local et PWA.
7. Analyse de visage plus poussée et export PDF.
