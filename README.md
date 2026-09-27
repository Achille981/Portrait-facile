# Portrait facile

Portrait facile est une SPA locale de référence pour le dessin de portrait. Elle permet d'importer une image, superposer un guide de construction ajustable, comparer avec une aide assistée et exporter une version finale prête à travailler. Le produit évolue progressivement vers un Portrait Construction Rig partagé plutôt qu'une collection de repères 2D indépendants.

## Ce qui est livré

- Import d'image JPG / PNG / WebP
- Grille de construction et repères de face
- Quatre niveaux de guide : essentiel, construction, détaillé, expert
- Ajustements manuels du guide : décalage horizontal, vertical, taille du visage
- Manipulation directe du guide sur le canvas : glisser pour déplacer, poignée pour redimensionner, contrôles clavier accessibles
- Contrôle d'opacité, zoom et mode d'affichage
- Assistance visuelle MediaPipe optionnelle, non autoritaire et explicitement assistive
- Comparaison guide / assistance
- Projets enregistrés localement via IndexedDB
- Création, duplication, renommage, switch et suppression de projets
- Sauvegarde complète d'un projet en JSON et restauration sous un nouveau projet, photo incluse
- Export PNG du canvas ou recadré sur la photo à sa résolution d'origine
- PWA installable basique avec service worker
- Modèle canonique de tête versionné en coordonnées 3D normalisées, socle du rig paramétrique
- Bibliothèque de départ Front / 3/4 gauche / 3/4 droit / profils gauche et droit, sur le même rig paramétrique
- Ajustement initial assisté par repères MediaPipe (échelle, position et roulis), toujours vérifiable et corrigeable à la main
- Méthodes canonique, Loomis, Reilly et Asaro dérivées du rig partagé, sélectionnées et sauvegardées par projet
- Réglages directs du regard et de l'expression, bornés et sauvegardés par projet

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

## Préparer une mise en production

L'application est une SPA statique : elle peut être publiée sur n'importe quel hébergeur
servant des fichiers statiques. Avant publication :

```bash
npm ci
npm run lint
npm run build
npm run preview
```

Le dossier `dist/` contient la version à publier. Configurez le serveur pour renvoyer
`index.html` lors des navigations SPA et servez les fichiers en HTTPS. Les projets et
les images restent stockés localement dans le navigateur de chaque utilisateur ;
aucune image n'est envoyée à un serveur par défaut.

## Architecture retenue

- React + TypeScript + Vite : base rapide pour une application locale premium et légère
- Canvas 2D : rendu direct à la demande, export net, sans surcharge inutile
- IndexedDB : persistance des projets et des réglages côté navigateur
- Sauvegardes JSON versionnées : transfert explicite d'un projet entre navigateurs ou appareils
- VisionProvider : contrat explicite pour des services assistifs futurs, avec MediaPipe comme implémentation réelle et optionnelle
- Portrait Construction Rig : socle géométrique indépendant de la résolution, paramétrable et versionné, avec projections de face, 3/4 et profil
- PWA : manifest et service worker minimaux pour un lancement local plus proche d'une vraie app

## Philosophie produit

L'application ne prétend pas détecter une vérité objective du visage. Elle fournit des repères utiles, modifiables et explicitement assistifs. Le guide manuel reste la source de vérité principale de la construction.

## Limites claires

- L'analyse assistée est utile mais limitée et non certaine
- Le fitting ne reconstruit pas le visage et ne modifie pas ses proportions ; il propose seulement un cadrage global borné et une inclinaison indicative
- Les méthodes Loomis, Reilly et Asaro sont des couches de construction schématiques, pas des reproductions exhaustives de cours ou de modèles anatomiques
- La couche d'assistance n'est pas une preuve de ressemblance ou de fidélité anatomique
- Le modèle canonique reste un gabarit de construction heuristique ; les vues latérales sont des projections pseudo-3D, pas une reconstruction anatomique
- L'app est une base solide pour un outil de travail localiste, mais pas encore un studio complet de retouche de portrait

## Suivant possible

Les prochaines évolutions possibles portent sur des formats d'export supplémentaires ; les méthodes dérivées partagent toujours le même modèle canonique.
