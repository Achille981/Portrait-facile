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
