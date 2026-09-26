# Architecture

Le projet est structuré pour séparer les responsabilités critiques:

- UI: tous les composants d'interface React.
- Rendering: logique de dessin sur canvas.
- Guides: génération des lignes et structures de support.
- Vision: fournisseurs de landmarks et estimations.
- Storage: persistance locale pour projets et paramétrage.
- Export: génération d'images et préparation PDF.

Cette séparation réduit les risques de couplage, facilite les tests et permet des évolutions sans réécrire le cœur du produit.
