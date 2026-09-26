# Registre des décisions architecturales

## Décision: Canvas 2D sur Konva pour le vertical slice

- Pourquoi: le besoin immédiat est un rendu robuste, un export fiable et un rendu performant sans surcomplexifier le code.
- Alternatives: Canvas natif, SVG, Fabric, Konva.
- Conclusion: Canvas 2D est adapté au premier produit fonctionnel; l'architecture est prête pour une évolution vers Konva si le besoin de manipulation d'objets devient fort.

## Décision: traitement local par défaut

- Pourquoi: l'utilisateur contrôle ses images et une photo personnelle ne doit pas être envoyée à un serveur de manière implicite.
- Conclusion: le code autorise un `VisionProvider` remplaçable, sans verrouiller l'application sur un service externe.

## Décision: abstraction du moteur de guides

- Pourquoi: il faut séparer la détection, la géométrie et le rendu afin de rester évolutif et de ne pas mélanger les responsabilités.
- Conclusion: les repères sont traités comme des éléments géométriques avec visibilité, priorité, style, source et confiance.

## Décision: modèle canonique avant les vues et le fitting

- Pourquoi: les vues Front, 3/4 et Profil doivent partager une même structure plutôt que devenir des dessins indépendants.
- Conclusion: le modèle canonique est un socle pseudo-3D versionné, en unités indépendantes de la résolution, avec parties hiérarchiques et guides typés. Il ne représente pas une analyse anatomique exacte ; le rig ajoute des paramètres bornés.
- Ordre retenu: modèle canonique → rig paramétrique → Front → 3/4 → Profil → fitting → autres modèles dérivés.

## Décision: fitting assistif et borné

- Pourquoi: les repères automatiques peuvent aider au cadrage, mais ne doivent pas remplacer le jugement de l'artiste ni imposer une anatomie estimée.
- Conclusion: MediaPipe propose une translation, une échelle et un roulis globaux à partir de repères suffisants. Les valeurs sont bornées, les proportions du rig restent intactes et les corrections manuelles restent disponibles ; l'analyse de l'image reste dans le navigateur.

## Décision: méthodes dérivées du même rig

- Pourquoi: Loomis, Reilly et Asaro doivent rester des méthodes de lecture et de construction, pas devenir des modèles incompatibles à maintenir séparément.
- Conclusion: chaque méthode sélectionne les repères canoniques utiles et ajoute uniquement des guides pédagogiques calculés depuis la géométrie déjà transformée du rig. La méthode est persistée par projet ; les anciennes versions utilisent Canonique par défaut.

## Décision: paramètres du rig contraints et indépendants de l'image

- Pourquoi: les proportions doivent rester stables quelle que soit la résolution de la photo, et des valeurs libres peuvent produire des déformations absurdes.
- Conclusion: les paramètres de forme, de pose, de regard, d'expression et de caméra vivent en unités normalisées, sont bornés à la normalisation et sont persistés dans chaque projet. Front, 3/4 et Profil sont initialisés depuis le même rig ; les vues nommées ne possèdent pas de géométrie indépendante.
