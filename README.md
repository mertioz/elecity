# Elecity · Le Ruisseau

Elecity est un jeu de gestion électrique en 3D. Le village et le plateau des Hauts bordent la même rivière. Le laboratoire affiche les mesures et les prévisions de la partie. [Présentation du jeu](https://aymen.site/fr/#elecity)

## Jeu

Ouvre **Paramètres**, puis **Langue de l’interface** pour passer du français à l’anglais. Elecity mémorise ton choix. Les relevés CSV suivent la langue de l’interface.

Lance l’application avec `npm start` ou ouvre **Elecity.exe** après compilation. La campagne démarre à midi avec 10 CR, une maison, un poste et un groupe d’appoint déjà raccordé. Les bâtiments se construisent sur les emplacements indiqués et sont raccordés automatiquement. La caméra reste libre.

1. Ouvre **Préparer le groupe**, puis reproduis les cinq commandes A à D. Chaque commande réussie prépare 2 kWh à puissance nominale, avec un bonus de 3 kWh si la séquence est parfaite. Une séquence est possible par heure.
2. Tant que le jeu est ouvert, une heure passe toutes les 20 secondes, y compris dans les fiches et le laboratoire. À chaque changement d’heure, le jeu répartit l’énergie, débite le combustible utilisé et crédite 1,60 CR par kWh livré aux bâtiments.
3. Installe le moulin hydraulique quand tu l’as financé. Il automatise la production selon le débit du ruisseau à l’heure jouée. Développe les logements et complète le réseau avec le solaire ou la batterie quand la demande monte.
4. Le groupe, le moulin, la centrale nucléaire et sa pompe se règlent de 0 à 150 %. Au-dessus de 100 %, les générateurs mobilisent davantage de ressources par kWh et le pompage demande davantage d’énergie par m³. L’eau turbinée retourne au cours d’eau. Un bidon pour le groupe coûte 24 CR.
5. La centrale dispose d’une réserve d’eau et de combustible. Pour relancer une centrale privée d’eau, alimente sa pompe depuis le reste du réseau. La pompe démarre lorsque le réservoir a de la place. Le combustible de la centrale se rachète dans sa fiche.
6. La progression suit la population et la continuité électrique. Les coupures prolongées font partir les habitants. Un logement régulièrement alimenté peut se remplir. La clinique dispose d’une autonomie de secours limitée.

Avec les premiers crédits, l’éolienne de prairie fournit une production variable pour 8 CR. La serre coûte 9 CR et vend une récolte de 8 CR après six heures alimentées à au moins 90 %. Les parcelles se trouvent depuis le catalogue ou les repères « + » sur la carte.

Après Les Terrasses, le poste des Hauts ouvre la traversée moyenne tension et ses deux pylônes. Le parc éolien des Crêtes peut charger la station de pompage-turbinage avec le surplus. Elle stocke 140 kWh et débite jusqu’à 36 kW, avec une consigne automatique, de pompage ou de turbinage. La halle ferroviaire rapporte 96 CR lorsque chacun des trois créneaux précédant un départ de 08 h ou de 20 h est alimenté à 95 %. Les ateliers du village sont rémunérés par les récoltes et les trains. L’objectif final associe 30 habitants, une journée de service fiable et trois trains expédiés.

## Recherche et calcul

Cet onglet affiche les prévisions sur 24 h, les puissances, les tensions, les courants, les pertes et les stocks. Il comprend un glossaire interrogeable, une calculatrice triphasée et une calculatrice hydraulique. Le relevé horaire s’exporte en CSV. Les cartes JSON de GridLab s’analysent en lecture seule. Au premier lancement, Elecity reprend la sauvegarde locale de GridLab si elle existe.

Les hypothèses restent celles d’un jeu. La calculatrice triphasée utilise un circuit équilibré. Le rendement et le débit du moulin sont réglés pour la progression. [Calcul des chutes de tension, Schneider Electric](https://fr.electrical-installation.org/frwiki/Calcul_de_la_chute_de_tension_en_ligne_en_r%C3%A9gime_permanente) · [Microhydropower Handbook, U.S. Department of Energy](https://www1.eere.energy.gov/water/pdfs/doewater-10107-vol.1-pt1.pdf)

## Développement

Avec Node.js et npm installés, récupère les sources et lance le jeu.

```sh
git clone https://github.com/mertioz/elecity.git
cd elecity
npm ci
npm start
```

`npm test` vérifie la simulation. Sous Windows, `npm run build:windows` produit `dist/Elecity.exe`. `npm run build:vendor` reconstruit le bundle Three.js.

## English interface

Open **Settings** and choose **English** under **Interface language**. The game, map, diagnostics, research tools and CSV exports use the selected language. To run from a checkout, use `npm ci` and `npm start`. On Windows, `npm run build:windows` produces `dist/Elecity.exe`.

## Licence

Le code d’Elecity est sous licence [MIT](LICENSE). Le bundle Three.js conserve [la licence de ses auteurs](vendor/three-LICENSE.txt).
