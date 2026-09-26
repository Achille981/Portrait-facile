# Portrait facile

Portrait facile est une SPA locale de référence pour le dessin de portrait. Elle permet d'importer une image, superposer un guide de construction ajustable, comparer avec une aide assistée et exporter une version finale prête à travailler.

## Ce qui est livré

- Import d'image JPG / PNG / WebP
- Grille de construction et repères de face
- Trois niveaux de guide : essentiel, standard, détaillé
- Ajustements manuels du guide : décalage horizontal, vertical, taille du visage
- Contrôle d'opacité, zoom et mode d'affichage
- Assistance visuelle MediaPipe optionnelle, non autoritaire et explicitement assistive
- Comparaison guide / assistance
- Projets enregistrés localement via IndexedDB
- Création, duplication, renommage, switch et suppression de projets
- Export PNG de la composition finale
- PWA installable basique avec service worker

## Démarrer

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 4173
```

Validation disponible :

```bash
npm run lint
npm run build
```

## Architecture retenue

- React + TypeScript + Vite : base rapide pour une application locale premium et légère
- Canvas 2D : rendu direct à la demande, export net, sans surcharge inutile
- IndexedDB : persistance des projets et des réglages côté navigateur
- VisionProvider : contrat explicite pour des services assistifs futurs, avec MediaPipe comme implémentation réelle et optionnelle
- PWA : manifest et service worker minimaux pour un lancement local plus proche d'une vraie app

## Philosophie produit

L'application ne prétend pas détecter une vérité objective du visage. Elle fournit des repères utiles, modifiables et explicitement assistifs. Le guide manuel reste la source de vérité principale de la construction.

## Limites claires

- L'analyse assistée est utile mais limitée et non certaine
- La couche d'assistance n'est pas une preuve de ressemblance ou de fidélité anatomique
- L'app est une base solide pour un outil de travail localiste, mais pas encore un studio complet de retouche de portrait

## Suivant possible

Les axes de progression réalistes restent : export plus riche, historique de versions, comparaison de projets, et éventuellement un moteur de guide plus avancé basé sur des modèles de proportion plus solides.
