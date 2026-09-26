# Architecture

Le projet est structuré pour séparer les responsabilités critiques:

- UI: tous les composants d'interface React.
- Rendering: logique de dessin sur canvas.
- Domain / Rig: modèle canonique de tête en coordonnées 3D normalisées, indépendant de la résolution de l'image.
- Guides: sélection des repères du rig et génération des structures de support.
- Vision: fournisseurs de landmarks et estimations.
- Storage: persistance locale pour projets et paramétrage.
- Export: génération d'images et préparation PDF.

Cette séparation réduit les risques de couplage, facilite les tests et permet des évolutions sans réécrire le cœur du produit.

## Ordre de construction du Portrait Construction Rig

Le développement suit volontairement cet ordre : modèle canonique, rig paramétrique, vue de face, vue trois-quarts, profil, fitting, puis dérivation des autres modèles. La bibliothèque ne doit pas devenir une collection de dessins indépendants.

Le modèle canonique actuel est un gabarit géométrique, pas une détection du visage ni une vérité anatomique. Son repère utilise une hauteur de tête normalisée de 2 unités, un axe Y vers le haut, un axe Z vers l'avant et un axe X orienté vers la gauche anatomique du sujet. Les guides sont versionnés, rattachés à des parties hiérarchiques et décrits avec leur géométrie, niveau, priorité, visibilité, source et confiance.

Le rig paramétrique applique des transformations contraintes au crâne, au plan facial, à la mâchoire, aux traits, aux oreilles et au cou, puis une pose continue yaw/pitch/roll. Le regard et l'expression restent des paramètres séparés de la pose. Les paramètres sont stockés par projet et normalisés à la lecture pour migrer les documents existants sans perdre leurs réglages. Le niveau courant contrôle la sélection des repères visibles ; le modèle complet n'est pas dessiné en permanence.

La bibliothèque initialise maintenant Front, 3/4 gauche/droit et Profil gauche/droit à partir du même rig, en changeant yaw et perspective plutôt qu'en créant des dessins séparés. Une sélection contextuelle masque les repères du côté éloigné et privilégie le contour en profil. Le rendu Canvas consomme les guides projetés et les paramètres de forme/pose sont réglables dans le panneau. Les vues latérales sont des approximations pseudo-3D, non une reconstruction anatomique.

Le fitting utilise des repères faciaux détectés localement par MediaPipe pour proposer une échelle, une translation et un roulis initiaux. Les limites robustes écartent les coordonnées hors image, les boîtes dégénérées et les détections insuffisantes ; les corrections sont bornées et l'interface invite à une vérification manuelle. Le fitting ne déforme pas les proportions du rig et ne constitue pas une mesure de ressemblance.

Les méthodes Loomis, Reilly et Asaro sont dérivées après le fitting sous forme de sélections et de surcouches de guides calculées depuis le rig transformé. Elles ne possèdent pas de géométrie faciale indépendante : paramètres, pose, vues et corrections restent communs. La méthode choisie est stockée dans le document projet, avec migration vers Canonique pour les versions antérieures.
