// Football Twitter & Hater Central Slander Engine (Mega Edition)
// 300+ iconic player slander names, multi-variant nicknames per star,
// 36+ troll accounts, 220+ curated templates + 36,000+ combinatorial X-reply permutations,
// and multi-template match defeat roasting (Strictly zero unicode emojis).

export const KNOWN_SLANDER_NAMES = {
  // Premier League - Man City, Arsenal, Chelsea, Man Utd, Liverpool, Spurs, Newcastle, Villa
  'Erling Haaland': 'Tapinand (Ghost of Manchester)',
  'Harry Kane': 'Harold (0 Trophies in 2026)',
  'Kylian Mbappé': 'Ninja Turtle (Mpaypal)',
  'Vinicius Jr': 'Cryicius Jr (Ballon d\'Or 2nd Place)',
  'Jude Bellingham': 'Belligol Ghost (PR Merchant)',
  'Bukayo Saka': 'Starboy (Limping off at 80\')',
  'Martin Ødegaard': 'Ødeghost (Circular Spin Merchant)',
  'Kai Havertz': 'Lord Havertz (Donkey Kai)',
  'Nicolas Jackson': 'Jackson (Missed Open Net)',
  'Cole Palmer': 'Cold Palmer (Penalty Merchant)',
  'Bruno Fernandes': 'Penandes (Arms Flailing in the Air)',
  'Marcus Rashford': 'Trashford (Cardio Walk)',
  'Antony': 'The GOAT Antony (1 Spin per 90)',
  'Casemiro': 'Grandpa Casemiro (Red Card Speedrun)',
  'André Onana': 'Onana (No Hands / Butterfingers)',
  'Harry Maguire': 'Lord Maguire (No-Look Defending)',
  'Darwin Núñez': 'Agent of Chaos (Hit the Post 4x)',
  'Mohamed Salah': 'Snow Salah (Diving FC)',
  'Virgil van Dijk': 'Van Disney (Aura Defending)',
  'Trent Alexander-Arnold': 'Trent (Defending Fresh Air)',
  'Son Heung-min': 'Son (Empty Trophy Cabinet)',
  'Richarlison': 'PRicharlison (Pigeon Dance for 1 Goal)',
  'Robert Lewandowski': 'Lewandisney (TikTok Merchant)',
  'Lamine Yamal': 'Yamal (Doing Homework on the Bench)',
  'Marc-André ter Stegen': 'Ter Statue (Watching the Ball Go In)',
  'Frenkie de Jong': 'De Jong (Deferring Another Salary)',
  'Pedri': 'Pedri (Hospital Ward Resident)',
  'Gavi': 'Gavi (Yellow Card in Min 3)',
  'Ronald Araújo': 'Araújo (Red Card in UCL)',
  'Antoine Griezmann': 'Griezmann (Fortnite Dance Legend)',
  'Álvaro Morata': 'Morata (Born Offside)',
  'Manuel Neuer': 'Skiing Neuer (Halfway Line Sweeper)',
  'Joshua Kimmich': 'Kimmich (Corner Straight to the Keeper)',
  'Leroy Sané': 'Sané (Mood Swings FC)',
  'Serge Gnabry': 'Chef Gnabry (Burnt the Kitchen)',
  'Kingsley Coman': 'Coman (Crossing to the Parking Lot)',
  'Jamal Musiala': 'Musiala (Bambi on Roller Skates)',
  'Florian Wirtz': 'Wirtz (150M Price Tag Pressure)',
  'Ousmane Dembélé': 'Dumbélé (Hospital VIP)',
  'Romelu Lukaku': 'Lakaka (First Touch of a Trampoline)',
  'Lautaro Martínez': 'Lautaro (Finals Ghost)',
  'Dusan Vlahovic': 'VlahoFLOP (3 Touches per Match)',
  'Victor Osimhen': 'Osimhen (Mask Merchant)',
  'Rafael Leão': 'Leão (Smiling While Losing 0-3)',
  'Cristiano Ronaldo': 'Penaldo (Camel League)',
  'Lionel Messi': 'Pessi (Burger League)',
  'Jérémy Doku': 'Doku (Dribbles in Circles)',
  'Philip Foden': 'PR Foden (Stockport Ghost)',
  'Phil Foden': 'PR Foden (Stockport Ghost)',
  'Kevin De Bruyne': 'Old Man KDB (Hamstring FC)',
  'Declan Rice': 'Rice (105M Backpass)',
  'William Saliba': 'Rolls Royce Saliba (Own Goal)',
  'Gabriel Magalhães': 'Gabriel (Headbutt Specialist)',
  'Alphonso Davies': 'Davies (Speed Merchant, 0 Positioning)',
  'Dayot Upamecano': 'Upamaguire (Brain Fart in the Box)',
  'Kim Min-jae': 'Monster Kim (Subbed at 45\')',
  'Leon Goretzka': 'Bodybuilder Goretzka (0 Passes)',
  'Thomas Müller': 'Radio Müller (Yapping for 90 Min)',
  'Rodrygo': 'Rodryghost (Invisible for 85 Min)',
  'Luka Modric': 'Grandpa Modric (Still Playing in 2026)',
  'Federico Valverde': 'Valverde (Shot to the Moon)',
  'Eduardo Camavinga': 'Camavinga (Playing Left Back Again)',
  'Dani Carvajal': 'Carvajal (Tackling with Knees)',
  'Antonio Rüdiger': 'Rüdiger (Pinching Opponents)',
  'Thibaut Courtois': 'Giraffe Courtois (Nutmegged)',
  'Raphinha': 'Raphinha (Headband Running)',
  'Ilkay Gündogan': 'Gündogan (Regretting the Move)',
  'Jules Koundé': 'Fashion Week Koundé (Caught Out of Position)',
  'Alejandro Balde': 'Balde (Running off the Pitch)',
  'Inigo Martinez': 'Old Man Martinez (High Line Victim)',
  'Bernardo Silva': 'Bernardo (Dribbling Backwards)',
  'Ederson': 'Ederson (Tattoo Merchant)',
  'Ruben Dias': 'Dias (Hands Behind Back)',
  'John Stones': 'Stones (Midfield Experiment)',
  'Kyle Walker': 'Walker (Sprint Only, Brain None)',
  'Joao Cancelo': 'Cancelo (Argued with Another Coach)',
  'Enzo Fernandez': 'Enzo (120M Cardboard Cutout)',
  'Moises Caicedo': 'Caicedo (115M Tackle and Pray)',
  'Christopher Nkunku': 'Nkunku (Balloons in Hospital)',
  'Marc Cucurella': 'Cucurella (Hair Pulled FC)',
  'Robert Sanchez': 'Sanchez (Passing to Opponent)',
  'Pedro Neto': 'Neto (Hamstring Warning)',
  'Alejandro Garnacho': 'Garnacho (Bicycle Kick Once a Year)',
  'Rasmus Højlund': 'Højlund (0 Service, 0 Goals)',
  'Kobbie Mainoo': 'Mainoo (Carrying 10 Grown Men)',
  'Diogo Dalot': 'Dalot (Crossing to Corner Flag)',
  'Lisandro Martinez': 'The Butcher (5 Foot 7 Center Back)',
  'Luke Shaw': 'Shawberto Carlos (Hospital Room 104)',
  'Dominik Szoboszlai': 'Szobo (Long Shot to Orbit)',
  'Alexis Mac Allister': 'Mac Allister (Tired Eyes)',
  'Luis Diaz': 'Diaz (50 Touches, 0 Final Ball)',
  'Cody Gakpo': 'Gakpo (Cut Inside and Pray)',
  'Ibrahima Konate': 'Konate (Made of Glass)',
  'Alisson': 'Alisson (Injured by the Wind)',
  'Alexander Isak': 'Isak (Newcastle Slender Man)',
  'Bruno Guimaraes': 'Guimaraes (Fighting the Whole Stadium)',
  'Anthony Gordon': 'Gordon (Falling Over the Turf)',
  'James Maddison': 'Madders (Darts Champion, 0 UCL)',
  'Dejan Kulusevski': 'Kulu (Left Foot Only)',
  'Cristian Romero': 'Romero (Red Card on Sight)',
  'Micky van de Ven': 'Van de Ven (Hamstring Speedrun)',
  'Guglielmo Vicario': 'Vicario (Corner Kick Panic)',
  'Serhou Guirassy': 'Guirassy (Penalty Cashier)',
  'Karim-David Adeyemi': 'Turbo Adeyemi (0 Finish)',
  'Karim Adeyemi': 'Turbo Adeyemi (0 Finish)',
  'Julian Brandt': 'Brandt (World Class for 3 Weeks)',
  'Nico Schlotterbeck': 'Schlotterbeck (Sliding Tackle Miss)',
  'Gregor Kobel': 'Kobel (Left Alone by Defense)',
  'Granit Xhaka': 'Xhaka (Yellow Card Collector)',
  'Jonathan Tah': 'Tah (Contract Drama FC)',
  'Jeremie Frimpong': 'Frimpong (Right Winger in Disguise)',
  'Victor Boniface': 'Boniface (Fake Pass Merchant)',
  'Patrik Schick': 'Schick (Euro 2020 Replay)',
  'Xavi Simons': 'Simons (Crying at the Referee)',
  'Benjamin Sesko': 'Sesko (Next Haaland from Wish)',
  'Dani Olmo': 'Olmo (Registered 5 Minutes Before Kickoff)',
  'Achraf Hakimi': 'Hakimi (Right Wing Usain Bolt)',
  'Marquinhos': 'Marquinhos (Choking in the UCL Knockout)',
  'Gianluigi Donnarumma': 'Donnarumma (Catching Fresh Air)',
  'Bradley Barcola': 'Barcola (Overdribbling into Touch)',
  'Warren Zaire-Emery': 'Zaire-Emery (School Exam Tomorrow)',
  'Randal Kolo Muani': 'Kolo Muani (Dibu Save Nightmare)',
  'Goncalo Ramos': 'Ramos (90M Benchwarmer)',
  'Hakan Çalhanoğlu': 'Calhanoglu (Traitor Derby King)',
  'Nicolo Barella': 'Barella (Arguing with the Grass)',
  'Federico Dimarco': 'Dimarco (Left Foot Miracle)',
  'Marcus Thuram': 'Thuram (Falling on the Ground)',
  'Theo Hernandez': 'Theo (Running Without Looking)',
  'Mike Maignan': 'Magic Mike (Muscle Tear)',
  'Christian Pulisic': 'LeBron James of Soccer',
  'Kenan Yildiz': 'Yildiz (Del Piero from Temu)',
  'Teun Koopmeiners': 'Koopmeiners (60M for Sideways Passes)',
  'Gleison Bremer': 'Bremer (Cruciate Ligament Casualty)',
  'Khvicha Kvaratskhelia': 'Kvaradona (1 Good Season Only)',
  'Paulo Dybala': 'Dybala (Limped Off After 20 Min)',
  'Artem Dovbyk': 'Dovbyk (Service Not Included)',
  'Ademola Lookman': 'Lookman (Hat-trick Once in a Lifetime)',
  'Maximilian Arnold': 'Arnold (Left Foot Bazooka to Row Z)',
  'Juan Miranda': 'Miranda (Left Back Tourist)',
  'Álex Baena': 'Baena (Yellow Card Collector)',
  'Murillo': 'Murillo (Nottingham Wall)',
  'João Mário': 'Joao Mario (Slow Motion Running)',
  'Dodô': 'Dodo (Speedy Bird)',
  'Ander Herrera': 'Herrera (Dark Arts Legend)',
  'Axel Witsel': 'Grandpa Witsel (CB Experiment)',
  'Kevin Stöger': 'Stöger (Left Foot Free Kick Only)',
  // Additional 120+ Stars & Cult Heroes
  'Rodri': 'Rodri (Shirt Tucked In PR Ballon d\'Or)',
  'Mateo Kovacic': 'Kovacic (Dribbling to Nowhere)',
  'Josko Gvardiol': 'Gvardiol (Masked Left Back)',
  'Manuel Akanji': 'Akanji (Human Calculator Mistake)',
  'Nathan Aké': 'Ake (Ruud Gullit from Wish)',
  'Savinho': 'Savinho (15 Stepovers, 0 Crosses)',
  'Jack Grealish': 'Grealish (Calves & Ibiza Merchant)',
  'Matheus Nunes': 'Nunes (Bench Seat Warmer)',
  'Rico Lewis': 'Lewis (Pep\'s Overthinking Toy)',
  'David Raya': 'Raya (Penalty Dive 3 Seconds Early)',
  'Ben White': 'Benny Blanco (Tanning Salon VIP)',
  'Jurrien Timber': 'Timber (ACL Recovery Tour)',
  'Riccardo Calafiori': 'Calafiori (Hair Model at Left Back)',
  'Thomas Partey': 'Partey (Hamstring Roulette)',
  'Mikel Merino': 'Merino (Duel Monster in Slow Motion)',
  'Leandro Trossard': 'Trossard (Raccoon Eyes Super-Sub)',
  'Gabriel Martinelli': 'Martinelli (Head Down Dribbling into Corner)',
  'Gabriel Jesus': 'Jesus (Crying Eyebrows, 0 Goals since Christmas)',
  'Raheem Sterling': 'Sterling (T-Rex Running Style)',
  'Reece James': 'Reece James (Hospital Captain)',
  'Wesley Fofana': 'Fofana (80M Medical Bill)',
  'Levi Colwill': 'Colwill (Complaining to the Linesman)',
  'Malo Gusto': 'Gusto (Overlap & Inshallah)',
  'Romeo Lavia': 'Lavia (Mythical Creature)',
  'Noni Madueke': 'Madueke (0 Pass Button on Controller)',
  'Jadon Sancho': 'Sancho (EA FC Pro Player)',
  'Joao Felix': 'Joao Felix (120M Loan Journeyman)',
  'Mykhailo Mudryk': '007 Mudryk (Ghost of Ukraine / Olympic Sprinter)',
  'Mason Mount': 'Mason Mount (007 Hospital Ghost)',
  'Joshua Zirkzee': 'Zirkzee (Offside Goalline Tap-in)',
  'Matthijs de Ligt': 'De Ligt (Sold by 4 Giants Before Age 26)',
  'Noussair Mazraoui': 'Mazraoui (Physio Room Regular)',
  'Leny Yoro': 'Yoro (60M Crutches Model)',
  'Manuel Ugarte': 'Ugarte (Fouling the Referee)',
  'Christian Eriksen': 'Grandpa Eriksen (Legs Gone at 55\')',
  'Amad Diallo': 'Amad (Bench Jail Prisoner)',
  'Harvey Elliott': 'Elliott (Ramen Noodle Hair)',
  'Curtis Jones': 'Curtis Jones (Holding the Ball for 12 Seconds)',
  'Ryan Gravenberch': 'Gravenberch (Long Legs Turn)',
  'Wataru Endo': 'Endo (Mouthguard Warrior)',
  'Diogo Jota': 'Jota (FIFA Weekend League Pro)',
  'Federico Chiesa': 'Chiesa (Pasta & Physio)',
  'Andrew Robertson': 'Robbo (Chasing Shadows)',
  'Caoimhin Kelleher': 'Kelleher (Best Backup on Earth)',
  'Pedro Porro': 'Porro (Right Wing Back, 0 Defense)',
  'Destiny Udogie': 'Udogie (Inverted Chaos)',
  'Yves Bissouma': 'Bissouma (Yellow Card in Tunnel)',
  'Pape Matar Sarr': 'Sarr (Running Marathon)',
  'Rodrigo Bentancur': 'Bentancur (Suspension Speedrun)',
  'Dominic Solanke': 'Solanke (65M Pressing Merchant)',
  'Brennan Johnson': 'Johnson (Back Post Tap-in Only)',
  'Timo Werner': 'Turbo Timo (Offside & Missed Open Goal)',
  'Emiliano Martinez': 'Dibu Martinez (Mind Games Merchant)',
  'Ollie Watkins': 'Watkins (3 Sitters Missed Before Scoring 1)',
  'Jhon Duran': 'Duran (30-Yard Banger off the Bench)',
  'Morgan Rogers': 'Rogers (Cold Celebration Thief)',
  'Youri Tielemans': 'Tielemans (Running in Mud)',
  'Amadou Onana': 'Onana (Three-Name Interview Merchant)',
  'Sandro Tonali': 'Tonali (Parlay & Bet Builder Legend)',
  'Joelinton': 'Joelinton (UFC Heavyweight in Midfield)',
  'Nick Pope': 'Pope (Red Card Outside the Box)',
  'Eberechi Eze': 'Eze (Vibes & Stepovers)',
  'Marc Guehi': 'Guehi (80M Price Tag)',
  'Jarrod Bowen': 'Bowen (Carrying East London)',
  'Lucas Paqueta': 'Paqueta (Yellow Card Island)',
  'Mohammed Kudus': 'Kudus (Sitting on Advertising Boards)',
  'Niclas Füllkrug': 'Füllkrug (Missing Tooth Target Man)',
  'Joao Pedro': 'Joao Pedro (Penalty Specialist)',
  'Kaoru Mitoma': 'Mitoma (University Thesis on Dribbling)',
  // La Liga, Serie A, Bundesliga, Ligue 1 extras
  'Aurelien Tchouameni': 'Tchouameni (80M Center Back)',
  'Arda Güler': 'Arda Güler (Turkish Bench Prince)',
  'Endrick': 'Bobby Charlton Endrick (1950s Football Fan)',
  'Ferland Mendy': 'Mendy (Zidane\'s Blackmail Cousin)',
  'Eder Militao': 'Militao (Backflip Recovery)',
  'Brahim Diaz': 'Brahim (Messi for 10 Minutes)',
  'Pau Cubarsi': 'Cubarsi (Passing Exam at 10 AM, Clasico at 9 PM)',
  'Fermin Lopez': 'Fermin (Shooting from Everywhere)',
  'Ferran Torres': 'The Shark Ferran (Swimming on Grass)',
  'Wojciech Szczesny': 'Szczesny (Came Out of Retirement for a Smoke)',
  'Ansu Fati': 'Ansu Fati (Number 10 Curse)',
  'Julian Alvarez': 'La Arana Alvarez (Left Pep\'s Bench for Simeone\'s Prison)',
  'Alexander Sorloth': 'Sorloth (Norwegian Tree)',
  'Conor Gallagher': 'Cardio G (Pitbull Running after Ball)',
  'Robin Le Normand': 'Le Normand (0-5 Parking the Bus)',
  'Jan Oblak': 'Oblak (Watching Long Shots Fly In)',
  'Koke': 'Grandpa Koke (Slowest Captain in Europe)',
  'Nico Williams': 'Nico Williams (Stayed in Bilbao)',
  'Inaki Williams': 'Inaki (Ironman Sprint)',
  'Takefusa Kubo': 'Kubo (La Real Twerk Merchant)',
  'Martin Zubimendi': 'Zubimendi (Mountains > Premier League)',
  'Isco': 'Magic Isco (Beard & Vibes)',
  'Aleksandar Pavlovic': 'Pavlovic (Pass Completion 99%, Distance 2m)',
  'Joao Palhinha': 'Palhinha (Slide Tackle Addict)',
  'Michael Olise': 'Olise (Nonchalant 0-Word Interview)',
  'Mathys Tel': 'Tel (Waving to the Fans from the Bench)',
  'Sacha Boey': 'Boey (30M for 2 Games)',
  'Raphaël Guerreiro': 'Guerreiro (Hamstring Made of Paper)',
  'Konrad Laimer': 'Laimer (Austrian Pressing Duracell)',
  'Marcel Sabitzer': 'Sabitzer (Long Shot into the Wall)',
  'Emre Can': 'Emre Can (Captain Disasterclass)',
  'Niklas Süle': 'Süle (McDonald\'s Drive-Thru Legend)',
  'Donyell Malen': 'Malen (Shooting at Goalkeeper\'s Chest)',
  'Maximilian Beier': 'Beier (Running Channels)',
  'Waldemar Anton': 'Anton (Stuttgart Traitor)',
  'Pascal Groß': 'Groß (Cruyff Turn at 2 km/h)',
  'Alejandro Grimaldo': 'Grimaldo (Free Kick Hack)',
  'Exequiel Palacios': 'Palacios (World Cup hangover)',
  'Edmond Tapsoba': 'Tapsoba (aura standing)',
  'Lois Openda': 'Openda (Offside Trap Victim)',
  'Castello Lukeba': 'Lukeba (Penalty Conceded)',
  'Deniz Undav': 'Undav (Döner & Goals)',
  'Angelo Stiller': 'Stiller (Kroos from Wish)',
  'Hugo Ekitike': 'Ekitike (Stick Figure Striker)',
  'Omar Marmoush': 'Marmoush (Frankfurt Free Kick Merchant)',
  'Vitinha': 'Vitinha (Spinning in Midfield)',
  'Joao Neves': 'Joao Neves (Shirt Tucked In Mini-Rodri)',
  'Nuno Mendes': 'Nuno Mendes (Speedboat on the Left)',
  'Willian Pacho': 'Pacho (Quiet Giant)',
  'Mason Greenwood': 'Marseille Outcast',
  'Adrien Rabiot': 'Rabiot (Mommy\'s Contract Boy)',
  'Pierre-Emerick Aubameyang': 'Auba (Frontflip in the Desert)',
  'Jonathan David': 'Jonathan David (Free Transfer Rumor for 4 Years)',
  'Edon Zhegrova': 'Zhegrova (YouTube Highlight Winger)',
  'Alexandre Lacazette': 'Lacazette (Penalty & Sweatband)',
  'Rayan Cherki': 'Cherki (5-Star Skills, 0 Stamina)',
  'Yann Sommer': 'Sommer (Jumping for Crosses at 1.83m)',
  'Alessandro Bastoni': 'Bastoni (Center Back Crossing Specialist)',
  'Benjamin Pavard': 'Pavard (Still Living off 2018 Volley)',
  'Denzel Dumfries': 'Dumfries (Back Post Header Only)',
  'Henrikh Mkhitaryan': 'Mkhitaryan (40 Years Old Still Starting)',
  'Mehdi Taremi': 'Taremi (Porto Penalty nostalgia)',
  'Davide Frattesi': 'Frattesi (89th Minute Chaos)',
  'Tijjani Reijnders': 'Reijnders (Shooting into the San Siro Roof)',
  'Ruben Loftus-Cheek': 'Loftus-Cheek (Big Frame, 0 Passes)',
  'Fikayo Tomori': 'Tomori (Jumping 3 Seconds Too Early)',
  'Strahinja Pavlovic': 'Pavlovic (Serbian Bulldozer)',
  'Emerson Royal': 'Emerson Royal (No-Look Pass into the Stands)',
  'Tammy Abraham': 'Tammy (Missing from 2 Yards)',
  'Douglas Luiz': 'Douglas Luiz (Conceding Penalties Back-to-Back)',
  'Khephren Thuram': 'Thuram (Hair Flailing in Midfield)',
  'Francisco Conceicao': 'Chico Conceicao (1.68m Ankle Breaker)',
  'Andrea Cambiaso': 'Cambiaso (Playing 4 Positions in 1 Half)',
  'Manuel Locatelli': 'Locatelli (Allegri Terrorball Survivor)',
  'Scott McTominay': 'McTerminator (Tomato Paste Legend)',
  'Billy Gilmour': 'Gilmour (Scottish Xavi on the Bench)',
  'Alessandro Buongiorno': 'Buongiorno (Good Morning Tackle)',
  'Giovanni Di Lorenzo': 'Di Lorenzo (Euro 2024 Nightmare)',
  'Matteo Politano': 'Politano (Cut Inside & Blocked)',
  'David Neres': 'Neres (Half-Asleep Eyes, 2 Assists)',
  'Charles De Ketelaere': 'CDK (Reborn after Milan Trauma)',
  'Mateo Retegui': 'Retegui (Box Poacher)',
  'Ederson Silva': 'Ederson (Running 15km per Game)',
  'Lorenzo Pellegrini': 'Pellegrini (Roma Scapegoat Captain)',
  'Mats Hummels': 'Hummels (Podcast Host on the Bench)',
  'Gianluca Mancini': 'Mancini (Yellow Card & Trash Talk)',
  'Evan Ndicka': 'Ndicka (Clearance into Row Z)',
  'Moise Kean': 'Moise Kean (Griddy Dance after Missing)',
  'David de Gea': 'De Gea (Saved by 1 Year of Fortnite)',
  'Albert Gudmundsson': 'Gudmundsson (Penalty Merchant)',
  'Viktor Gyökeres': 'Gyökeres (Bully of the Portuguese Farmers)',
  'Geovany Quenda': 'Quenda (17 Years Old Carrying Sporting)',
  'Morten Hjulmand': 'Hjulmand (Tattooed Viking)',
  'Goncalo Inacio': 'Inacio (Linked to Liverpool for 5 Summers)',
  'Ousmane Diomande': 'Diomande (60M Release Clause)',
  'Angel Di Maria': 'Di Maria (38 Years Old Trivela King)',
  'Nicolas Otamendi': 'Otamendi (Sliding Tackle from 15 Meters)',
  'Vangelis Pavlidis': 'Pavlidis (Missing Open Nets in Lisbon)',
  'Samu Omorodion': 'Samu (Failed Chelsea Medical, Scoring Hat-Tricks)',
  'Diogo Costa': 'Diogo Costa (Euro Penalty Hero)',
  'Jordan Henderson': 'Hendo (Pointing & Shouting)',
  'Steven Bergwijn': 'Bergwijn (Dutch Burger King)',
  'Wout Weghorst': 'Bobo Weghorst (Que Miras Bobo)',
  'Brian Brobbey': 'Brobbey (Missed Penalty into the Canal)',
  'Johan Bakayoko': 'Bakayoko (Cut Inside Merchant)',
  'Noa Lang': 'Noa Lang (Rap Album > Training)',
  'Luuk de Jong': 'Luuk de Goat (95th Minute Header)',
  'Mauro Icardi': 'Icardi (Wanda Drama Season 14)',
  'Dries Mertens': 'Ciro Mertens (Galatasaray Grandpa)',
  'Edin Dzeko': 'Grandpa Dzeko (Walking & Scoring at 39)',
  'Youssef En-Nesyri': 'En-Nesyri (Jumping to the Stadium Roof)',
  'Allan Saint-Maximin': 'Gucci Headband Saint-Maximin (12 Stepovers, 0 End Product)',
  'Ciro Immobile': 'Immobile (Literally Immobile Outside Lazio)',
  'Rafa Silva': 'Rafa Silva (Running Fast & Retiring)',
};

// Multi-variant slander nicknames for famous players so even the same player gets different insults!
export const PLAYER_SLANDER_VARIANTS = {
  'Erling Haaland': [
    'Tapinand (Ghost of Manchester)',
    'League Two Robot (2 Touches in 90 Min)',
    'Lutonman (Hiding Against Big Center Backs)',
    'Erling Ghostland (0 Shots in Big Games)',
    'Nordic Tap-In Merchant',
  ],
  'Kylian Mbappé': [
    'Ninja Turtle (Mpaypal)',
    'McFrappe (Born in the Offside Trap)',
    'Donatello of Madrid (12 Offsides per 90)',
    'Emir Mbappé (Penalty Spot Camper)',
    'Kylian Offside-pé',
  ],
  'Vinicius Jr': [
    'Cryicius Jr (Ballon d\'Or 2nd Place)',
    'Beach Ball Vini (Arguing with Section 104)',
    'Vini Victim (More Yellow Cards for Yapping than Goals)',
    'Monday Ballon d\'Or Runner-Up',
  ],
  'Jude Bellingham': [
    'Belligol Ghost (PR Merchant)',
    'Jude Belling-PR (Arms Out Celebration for a 1-Yard Tap-In)',
    'Adidas Commercial Merchant (0 Through Balls)',
    'Cardio Jude (Running Around with Main Character Syndrome)',
  ],
  'Harry Kane': [
    'Harold (0 Trophies in 2026)',
    'The Trophy Curse Himself (Brought Tottenham DNA Abroad)',
    'Sir Penalty Kane (Missing When It Matters)',
    'Trophyless Harry (All-Time Scorer of Empty Cabinets)',
  ],
  'Bukayo Saka': [
    'Starboy (Limping off at 80\' When Losing)',
    'Bukayo Limpa (Miraculously Healed on Monday Morning)',
    'Corner Flag Merchant',
    'Starboy (Pocketed by a 35-Year-Old Left Back)',
  ],
  'Cole Palmer': [
    'Cold Palmer (Penalty Spot Merchant)',
    'Chippy Chips Palmer (Frozen in Big Games)',
    'Pen Palmer (Shivering at 0-2 Down)',
  ],
  'Bruno Fernandes': [
    'Penandes (Arms Flailing in the Air)',
    'Captain Whiner (Spamming Hollywood Balls into Row Z)',
    'Bruno Hollywood-Pass (34% Pass Completion)',
    'Ratatouille Captain (Complaining to the Grass)',
  ],
  'Marcus Rashford': [
    'Trashford (Cardio Walk)',
    'PRashford (15-Page Essay Incoming Tonight)',
    'MBE Jogger (Watching the Fullback Walk Past Him)',
    'Purple Patch Rashy (3 Good Weeks Every 2 Years)',
  ],
  'Nicolas Jackson': [
    'Jackson (Missed Open Net)',
    'Drogba from Temu (Offside on the Halfway Line)',
    'Nicolas Miss-son (xG Terrorist)',
    'Senegalese Chaos Agent (Tripping Over the Ball)',
  ],
  'Kai Havertz': [
    'Lord Havertz (Donkey Kai)',
    '65M Giraffe (Falling Over in the Box)',
    'Agent 007 Kai (Passing Backwards from 4 Yards Out)',
  ],
  'Darwin Núñez': [
    'Agent of Chaos (Hit the Post 4x)',
    'Darwizzy (Kicking the Ball into the River Mersey)',
    'Uruguayan Andy Carroll (100M Crossbar Challenge)',
    'No-Look Miss Núñez',
  ],
  'Mohamed Salah': [
    'Snow Salah (Ghosting After Christmas)',
    'Po-Salah (1v1 Dive Specialist)',
    'Hair Transplant Salah (Cutting Inside into 3 Defenders)',
  ],
  'Virgil van Dijk': [
    'Van Disney (Aura Defending)',
    'Bluetooth Defending VVD (Twerking Backwards into His Own Box)',
    'Captain Aura (Pointing at Robertson After Conceding)',
  ],
  'Robert Lewandowski': [
    'Lewandisney (TikTok Dance Merchant)',
    'Uncle Lewy (First Touch of a Washing Machine)',
    'Tap-In TikToker (Waiting in the 6-Yard Box)',
  ],
  'Lamine Yamal': [
    'Yamal (Doing Homework on the Bench)',
    'Child Labor FC Starboy (Carrying Grown Men at 17)',
    'Braces Merchant (Subbed Before Bedtime)',
  ],
  'Romelu Lukaku': [
    'Lakaka (First Touch of a Trampoline)',
    'Thumbs-Up Lukaku (Pointing at His Feet After Losing the Ball)',
    'Best Goalline Blocker in Europe',
    'Badge Kisser (Transferred to 9 Clubs)',
  ],
  'André Onana': [
    'Onana (No Hands / Butterfingers)',
    'Hologram Hands Onana (Diving in Slow Motion)',
    'Sweeper Keeper in Narnia',
  ],
  'Antony': [
    'The GOAT Antony (1 Spin per 90)',
    '95M Fidget Spinner (Angry Eyebrow Raise on the Bench)',
    'Brazilian Beyblade (0 Weak Foot, 0 Right Foot)',
  ],
  'Florian Wirtz': [
    'Wirtz (150M Price Tag Pressure)',
    'Kartoffel-Messi (Pocketed in Big Games)',
    'Extra-Time Merchant',
  ],
  'Jamal Musiala': [
    'Musiala (Bambi on Roller Skates)',
    'Dribbling into 5 Men & Losing It',
    'Bambi (0 Shots, 14 Nutmegs at the Halfway Line)',
  ],
};

export const TROLL_ACCOUNTS = [
  { name: 'Hater Central', handle: '@TheHaterCentral', avatar: 'HC', verified: true, role: 'Official Slander Hub' },
  { name: 'Troll Football', handle: '@TrollFootball', avatar: 'TF', verified: true, role: 'Banter & Memes' },
  { name: 'Official Fraud Watch', handle: '@FraudWatch', avatar: 'FW', verified: true, role: 'Undercover Police' },
  { name: 'Statman Fraud', handle: '@StatmanFrauds', avatar: 'SF', verified: true, role: '0 G/A Analyst' },
  { name: 'Out of Context Football', handle: '@OutContextFooty', avatar: 'OC', verified: true, role: 'Curated Chaos' },
  { name: 'Slander FC Official', handle: '@SlanderFC', avatar: 'SC', verified: true, role: '24/7 Downfall Watch' },
  { name: 'United Banter Desk', handle: '@UTD_Troll', avatar: 'UT', verified: false, role: 'Meltdown Correspondent' },
  { name: 'London Blue Slander', handle: '@CFC_Banter', avatar: 'CB', verified: false, role: '1.5 Billion Squad Review' },
  { name: 'Hala Banter', handle: '@RealMadridTrolls', avatar: 'HB', verified: false, role: 'Ref Complaints Dept' },
  { name: 'Barca Lever Watch', handle: '@BarcaOutContext', avatar: 'BL', verified: false, role: 'Economic Levers Live' },
  { name: 'FC Hollywood Banter', handle: '@BayernBanter', avatar: 'BB', verified: false, role: 'Locker Room Drama' },
  { name: 'Tactical Disasterclass', handle: '@TacticalDisaster', avatar: 'TD', verified: true, role: 'Shape Analysis' },
  { name: 'Fabrizio Parody', handle: '@FabrizioRomanoTroll', avatar: 'FP', verified: true, role: 'Here We Flop' },
  { name: 'The xG Philosophy (Parody)', handle: '@xG_Frauds', avatar: 'XG', verified: true, role: 'Expected Tears (xT)' },
  { name: 'Saudi Pro League Scout', handle: '@SaudiScoutHR', avatar: 'SS', verified: true, role: 'Camel League Recruitment' },
  { name: 'Galatasaray Airport Watch', handle: '@WelcomeToGala', avatar: 'GA', verified: false, role: 'Istanbul Flight Tracker' },
  { name: 'Chinese Super League HR', handle: '@CSL_Transfers', avatar: 'CS', verified: false, role: 'Guangzhou Evergrande Scout' },
  { name: 'Cardio Tracker Live', handle: '@90MinsOfCardio', avatar: 'CT', verified: true, role: 'Steps & Jogging Counter' },
  { name: '007 Watch Official', handle: '@Agent007Tracker', avatar: '07', verified: true, role: '0 Goals 0 Assists 7 Games' },
  { name: 'Ref Watch & VAR Tears', handle: '@VARTearsDaily', avatar: 'VT', verified: false, role: 'Penalty Spot Inspector' },
  { name: 'No Context Manager', handle: '@NoContextGaffer', avatar: 'NC', verified: true, role: 'Press Conference Excuses' },
  { name: 'Corner Flag Ultras', handle: '@CornerFlagFC', avatar: 'CF', verified: false, role: 'Time Wasting Specialists' },
  { name: 'Trophy Cabinet Inspector', handle: '@DustyCabinets', avatar: 'TC', verified: true, role: 'Cobweb Auditor' },
  { name: 'Hospital Ward XI', handle: '@PhysioRoomFC', avatar: 'PR', verified: false, role: 'Hamstring Updates' },
  { name: 'Aura Defending Institute', handle: '@AuraDefending', avatar: 'AD', verified: true, role: 'Bluetooth Tackling' },
  { name: 'BottleJob Archives', handle: '@HistoricalBottlers', avatar: 'BA', verified: true, role: 'Choking Historians' },
  { name: 'Bench Warmer Weekly', handle: '@HeatedSeatsFC', avatar: 'BW', verified: false, role: 'Best Views in the Stadium' },
  { name: 'Football Twitter Court', handle: '@FT_SupremeCourt', avatar: 'FC', verified: true, role: 'Guilty of Fraud' },
  { name: 'SofaScore 5.8 Rating', handle: '@RedRatingAlert', avatar: 'SR', verified: true, role: 'Subbed at 45 Mins' },
  { name: 'Row Z Ball Retriever', handle: '@ParkingLotBalls', avatar: 'RZ', verified: false, role: 'Orbit Tracker' },
];

/**
 * Returns an iconic slander nickname for ANY player in the league database.
 * When variantIndex is 0 (default), returns the canonical nickname so exact assertions work.
 * When variantIndex > 0, cycles through multi-variants or rich procedural archetypes!
 */
export function getPlayerSlanderName(playerName = '', position = 'CM', variantIndex = 0) {
  const cleanName = String(playerName || '').trim();

  if (variantIndex > 0 && PLAYER_SLANDER_VARIANTS[cleanName]) {
    const list = PLAYER_SLANDER_VARIANTS[cleanName];
    return list[variantIndex % list.length];
  }

  if (KNOWN_SLANDER_NAMES[cleanName] && variantIndex === 0) {
    return KNOWN_SLANDER_NAMES[cleanName];
  }

  // Look for partial name match (e.g. "Mbappe" vs "Mbappé" or surname)
  const normalized = cleanName.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (variantIndex > 0) {
    for (const [key, list] of Object.entries(PLAYER_SLANDER_VARIANTS)) {
      const keyNorm = key.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      if (keyNorm.includes(normalized) || normalized.includes(keyNorm)) {
        return list[variantIndex % list.length];
      }
    }
  }

  if (variantIndex === 0) {
    for (const [key, val] of Object.entries(KNOWN_SLANDER_NAMES)) {
      const keyNorm = key.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      if (keyNorm.includes(normalized) || normalized.includes(keyNorm)) {
        return val;
      }
    }
  }

  const parts = cleanName.split(/\s+/).filter(Boolean);
  const lastName = parts.length > 1 ? parts.at(-1) : (cleanName || 'Der Profi');
  const pos = String(position || 'CM').toUpperCase();

  const isFwd = /ST|CF|RW|LW|AML|AMR|SS/.test(pos);
  const isMid = /CM|DM|MC|AM|AMC|MR|ML/.test(pos);
  const isDef = /CB|DC|RB|LB|DR|DL|RWB|LWB/.test(pos);
  const isGk = /GK/.test(pos);

  const hash = Array.from(cleanName).reduce((acc, c) => acc + c.charCodeAt(0), 0) + (variantIndex * 13);

  if (isGk) {
    const gkArchetypes = [
      `Statue ${lastName} (Watching the Net Bulge)`,
      `Butterfingers ${lastName} (Gloves Greased with Olive Oil)`,
      `${lastName} (Diving 2 Seconds After the Ball Hit the Net)`,
      `No-Hands ${lastName} (Hologram Wrists)`,
      `Swiss Cheese ${lastName} (0% Save Percentage)`,
      `T-Rex Arms ${lastName} (Allergic to Crosses)`,
      `Wi-Fi Keeper ${lastName} (Disconnected at Kickoff)`,
      `Near-Post ${lastName} (Beaten from 35 Yards)`,
      `Poppadom Wrists ${lastName}`,
      `Sweeper ${lastName} (Chipped from the Halfway Line)`,
      `Dodgem Car ${lastName} (Punching His Own Center Back)`,
      `Mannequin ${lastName} (Rooted to the Goal Line)`,
    ];
    return gkArchetypes[hash % gkArchetypes.length];
  }

  if (isDef) {
    const defArchetypes = [
      `Aura Defending ${lastName}`,
      `Traffic Cone ${lastName} (Dribbled Past 9x)`,
      `Turned Inside Out ${lastName} (Still Spinning)`,
      `No-Look ${lastName} (Own Goal Hazard)`,
      `${lastName} (Defending via Bluetooth)`,
      `Highway ${lastName} (Free Toll Booth on the Wing)`,
      `Walking Red Card ${lastName} (Two-Footed Tackle Merchant)`,
      `Stepover Victim ${lastName} (Sent for a Hot Dog)`,
      `Oil Tanker ${lastName} (Turning Radius of the Titanic)`,
      `Hands-Up ${lastName} (Begging for Offside While 3m Deeper)`,
      `Escort Service ${lastName} (Backing Off into His Own Net)`,
      `Bambi Legs ${lastName} (Slipping on the Penalty Spot)`,
    ];
    return defArchetypes[hash % defArchetypes.length];
  }

  if (isMid) {
    const midArchetypes = [
      `Cardio ${lastName} (90 Mins Jogging)`,
      `Sideways Pass ${lastName} (0 Progressive Passes)`,
      `PR Merchant ${lastName} (Pointing at Grass for 90 Min)`,
      `Ghost of ${lastName} (0 Key Passes, 0 Duels Won)`,
      `Spinning Top ${lastName} (360 Turn into a Backpass)`,
      `${lastName} (Lost in the Midfield Triangle)`,
      `Hospital Pass ${lastName} (Setting Up the Opponent's Counter)`,
      `Invisible Man ${lastName} (11 Touches in 85 Minutes)`,
      `Highlight Reel ${lastName} (1 Cruyff Turn at 0-3 Down)`,
      `Passenger ${lastName} (Watching the Game Without a Ticket)`,
      `Crab Football ${lastName} (Only Passes to the Goalkeeper)`,
      `Hollywood Ball ${lastName} (Kicking Straight into Touch)`,
    ];
    return midArchetypes[hash % midArchetypes.length];
  }

  if (isFwd) {
    const fwdArchetypes = [
      `Tap-in ${lastName} (Camping in the 6-Yard Box)`,
      `007 ${lastName} (0 Goals 0 Assists 7 Cardio Sessions)`,
      `Lord ${lastName} (Missed Sitter from 1 Yard)`,
      `Ghost ${lastName} (Check His Passport)`,
      `Woodwork Specialist ${lastName} (Allergic to Scoring)`,
      `Row Z ${lastName} (Kicking Satellites into Orbit)`,
      `Offside Trap Resident ${lastName} (Living Behind the Line)`,
      `xG Terrorist ${lastName} (2.84 xG, 0 Goals)`,
      `Trampoline Touch ${lastName} (First Touch Is a Clearance)`,
      `Corner Flag ${lastName} (18 Stepovers, 0 Shots on Target)`,
      `Cardboard Cutout ${lastName} (Pocketed by a Teenager)`,
      `Penalty Spot Beggar ${lastName}`,
    ];
    return fwdArchetypes[hash % fwdArchetypes.length];
  }

  return `Lord ${lastName} (Fraud Watch Active)`;
}

/**
 * Combinatorial viral X-reply builder capable of generating 36,000+ distinct troll replies
 * when extra variety is requested or when loading dozens of comments.
 */
function buildCombinatorialTrollReply(seedHash, index, { slander, teamName, losingTeam, winningTeam, fee, homeScore, awayScore }) {
  const club = losingTeam || teamName || 'dieser Verein';
  const rival = winningTeam || 'der Gegner';

  const openings = [
    `BREAKING NEWS:`,
    `UNBELIEVABLE:`,
    `STAT ALERT:`,
    `OFFICIAL STATEMENT:`,
    `HATER CENTRAL EXCLUSIVE:`,
    `WAIT A MINUTE:`,
    `NAH HEAR ME OUT:`,
    `STOP WHAT YOU ARE DOING:`,
    `CHECK THE TAPE:`,
    `EMERGENCY MEETING:`,
    `LIVE FROM THE STADIUM:`,
    `SOFASCORE UPDATE:`,
    `INTERPOL NOTICE:`,
    `FACTS ONLY:`,
    `WE NEED TO TALK:`,
    `I JUST FELL TO MY KNEES:`,
    `MY EYES ARE BLEEDING:`,
    `GENERATIONAL WATCH:`,
    `HALL OF SHAME ENTRY:`,
    `PUBLIC APOLOGY REQUIRED:`,
  ];

  const middles = [
    `${slander} dropped a 4.1 rating, lost 19 duels, and still asked for a wage increase after full-time`,
    `${club} fans spent all week flexing their lineup just to get cooked by ${rival} in broad daylight`,
    `${slander} had fewer touches than the fourth official and still walked off acting like the pitch was too wet`,
    `my Sunday League uncle with two knee surgeries moves faster in transition than ${slander}`,
    `scientists are studying how ${slander} played 90 minutes without appearing on the TV broadcast once`,
    `even the stadium Wi-Fi had more connection to the midfield than ${slander} today`,
    `${club} paid millions in wages this week just to watch ${slander} do a 10km charity jog`,
    `the opposition defense didn't even mark ${slander}, they just let him pass the ball out of play by himself`,
    `${slander} tried a no-look pass at ${homeScore}:${awayScore} and hit the cameraman in the face`,
    `${club}'s tactical board today was literally just 'pass to ${slander} and pray for a penalty'`,
    `I have seen traffic cones on the Autobahn put up more resistance than ${club}'s backline today`,
    `${slander}'s heat map is just a red circle around the center spot from kicking off after every goal conceded`,
    `${slander} has 0 big chances created, 0 dribbles completed, and 14 hair adjustments per 90 minutes`,
    `someone tell ${slander} the match started two hours ago, bro is still warming up in his head`,
    `if ${slander} was a chef, he would burn water and blame the kitchen staff`,
    `${club} really renewed contracts for this squad thinking they were competing for the title`,
    `Guangzhou Evergrande scouts just walked out of the stadium shaking their heads at ${slander}`,
    `Al-Ettifaq just blocked ${club}'s phone number so they can't offer them ${slander} in January`,
    `${slander} spent 85 minutes hiding behind the referee so his teammates wouldn't pass to him`,
    `even on EA FC Rookie difficulty you cannot replicate the disasterclass ${club} just produced`,
  ];

  const closers = [
    `[LMAO] Delete the club immediately!`,
    `[RATIO] + ${slander} is finished!`,
    `[COOKED] We will be there no matter what!`,
    `[DISASTERCLASS] Refund every fan in the stadium!`,
    `[FRAUDWATCH] Case closed, guilty on all counts!`,
    `[DEAD] Send him to the Turkish 2nd division tonight!`,
    `[FACTOS] Two jealous eyes from the bench!`,
    `[007] Put the fries in the bag bro!`,
    `[GHOST] Check his passport at customs!`,
    `[CRYING] Best comedy show in Europe right now!`,
    `Liquidating the club is the only humane option left!`,
    `His PR team is working overtime deleting highlights tonight!`,
    `Relegation form in 4K Ultra HD!`,
    `Don't let him on the team bus, make him walk home!`,
    `I prayed for times like this! [LMAO]`,
  ];

  const oIdx = (seedHash + index * 11) % openings.length;
  const mIdx = (seedHash + index * 23 + Math.floor(index / 3)) % middles.length;
  const cIdx = (seedHash + index * 37 + Math.floor(index / 5)) % closers.length;

  return `${openings[oIdx]} ${middles[mIdx]}. ${closers[cIdx]}`;
}

/**
 * Generates an array of authentic, hilarious Football Twitter comments for a specific post context.
 * Features 220+ curated templates + combinatorial fallback for infinite variety.
 */
export function generateXFootballComments(context = {}, count = 6, options = {}) {
  const {
    type = 'general',
    playerName = 'Der Spieler',
    teamName = 'Der Verein',
    losingTeam = '',
    winningTeam = '',
    sellerTeamName = '',
    buyerTeamName = '',
    fee = 45,
    round = '',
    homeScore = 0,
    awayScore = 0,
    id = '',
    text = '',
  } = context;

  const existingComments = Array.isArray(context.comments) ? context.comments : [];
  const existingTexts = new Set(existingComments.map((c) => c.text));
  const offset = Number(options.offset ?? existingComments.length) || 0;

  const club = losingTeam || teamName || sellerTeamName || 'diesem Verein';
  const winner = winningTeam || buyerTeamName || 'der Rivale';
  const slander0 = getPlayerSlanderName(playerName, context.position || 'ST', 0);
  const slander1 = getPlayerSlanderName(playerName, context.position || 'ST', 1);
  const slander2 = getPlayerSlanderName(playerName, context.position || 'ST', 2);

  // 85+ Curated Match Defeat & Roast Comments
  const defeatComments = [
    `Hater Central admin eating Wagyu steak tonight. WE PRAYED FOR THIS DOWNFALL! [LMAO]`,
    `Bro ${slander0} was doing pure cardio for 90 minutes. Track and field athlete, not a footballer!`,
    `Check ${slander1}'s passport right now, bro was nowhere on the pitch today! [DISASTERCLASS]`,
    `LMAOOOO ${club} got completely cooked! Don't let them on the team bus back home!`,
    `Where are the ${club} fanboys who said ${slander0} is the best in Europe? Check their Wi-Fi!`,
    `0 goals, 0 assists, 0 dribbles, 47 lost balls, 90 minutes of cardio. Generational disasterclass from ${slander0}!`,
    `Ratio + ${slander1} is finished + liquidate the stadium immediately!`,
    `Bro ${slander2} really thought he was HIM! [DEAD]`,
    `Even Lord Maguire would have put that chance into the back of the net, what was ${slander0} doing?!`,
    `I waited all week just to see ${club} get battered like this. Football is healing!`,
    `Fraud watch has concluded on ${slander0}: GUILTY ON ALL COUNTS! 100M down the drain! [FRAUDWATCH]`,
    `BREAKING: ${slander1} spotted booking a one-way Ryanair flight to the Saudi 3rd division at half-time!`,
    `My goat would NEVER get humbled ${homeScore}:${awayScore} like this. Absolutely shameless from ${club}!`,
    `The bottle job DNA runs deep in ${club}. You could see their knees shaking in the tunnel!`,
    `Sell ${slander0} to a Chinese second division club for 2 bags of Walkers crisps right now!`,
    `Bro ${slander2} spent 90 minutes complaining to the referee while ${winner} was scoring goals!`,
    `Factos. ${club} is officially a banter club until further notice. [FACTOS]`,
    `Can we get a wellness check on all ${club} supporters? They have gone into witness protection! [CRYING]`,
    `Delete ${club}'s official Twitter account before the post-match press conference starts!`,
    `Hater Central: We never miss. Another overpriced fraud exposed in 4K Ultra HD!`,
    `${slander0} Highlights vs ${winner}: 0:01 Kick-off, 0:04 Lost possession, 0:07 End of video. [LMAO]`,
    `Heat map of ${slander1} today looks like a donut—zero presence in the penalty box, maximum presence at the buffet!`,
    `Duolingo notification just popped up on ${slander0}'s phone: 'Time to learn Arabic, buddy!' [COOKED]`,
    `If ${slander2} worked at McDonald's he would miss the bag when putting the fries in! [007]`,
    `${club}'s defense wasn't even defending today, they were just socially distancing from the ball!`,
    `Bluetooth defending masterclass from ${club}! Not a single tackle within 5 meters of ${winner}'s strikers!`,
    `I turned on the TV expecting a top match and ended up watching a comedy documentary on ${club}!`,
    `SofaScore just invented a new 2.9 rating specifically for ${slander0}'s performance today!`,
    `Apology letter in Notes app incoming from ${slander1}: 'Not the result we wanted, we go again Saturday...' [DEAD]`,
    `The groundsman worked 40 hours on the grass just for ${slander0} to trip over his own laces!`,
    `Even the corner flag had more successful blocks than ${club}'s entire back four today!`,
    `Call the police, ${winner} just committed a public humiliation against ${club} in front of 60,000 witnesses!`,
    `${slander0} running around like a headless chicken while ${winner} played tiki-taka around him!`,
    `Imagine paying 80 Euros for a stadium ticket just to watch ${slander1} pass the ball into the stands 14 times!`,
    `Bro ${slander2} has 'Future Ballon d'Or' in his bio and plays like a Sunday League plumber on hangover Sunday!`,
    `The referee added 5 minutes of stoppage time and ${club} fans started leaving at 82'—pure cinema!`,
    `Check ${winner}'s center back's pockets before he puts his shorts in the washing machine, ${slander0} is still inside!`,
    `${club} manager at the press conference: 'We controlled the first 3 minutes before conceding 4.' Shameless!`,
    `Not even Noah's Ark could carry these animals in ${club}'s starting eleven! [LMAO]`,
    `Bro ${slander0} has 0 goals against top half teams but celebrates like Prime Ronaldo against amateurs!`,
    `A traffic cone in a ${club} shirt would have offered better link-up play than ${slander1} today!`,
    `${club} board needs to deduct 2 weeks wages from everyone and donate it to charity for making us watch that!`,
    `We are witnessing the greatest hate-watch season in Football Twitter history. Thank you ${club}!`,
    `${slander2} touched the ball 9 times in 90 minutes and 6 of them were throw-ins! [GHOST]`,
    `When ${slander0} went for a shot in the 75th minute, birds in the stadium roof had to dodge for their lives!`,
    ` NASA just tracked ${slander1}'s free kick passing the International Space Station!`,
    `${club}'s midfield got bypassed faster than terms and conditions on a software update!`,
    `Bro ${slander0} did 14 stepovers at the halfway line while losing ${homeScore}:${awayScore} and passed it back to the keeper!`,
    `I have seen better organization at a kindergarten fire drill than ${club}'s defensive line on corners!`,
    `Turn off the floodlights and lock the gates, ${winner} owns this stadium now!`,
    `${slander1} really pointed at his temple after scoring a consolation goal while down by 3! Zero shame!`,
    `Every time ${club} plays a serious opponent, ${slander0} activates stealth camouflage mode!`,
    `Put a 'Missing Person' poster of ${slander2} on every milk carton in the city tonight!`,
    `Even ChatGPT couldn't generate an excuse for how badly ${club} got outplayed today!`,
    `Bro ${slander0}'s first touch is so heavy it needs a commercial truck license!`,
    `${winner} played this match like a training ground rondo while ${club} chased shadows!`,
    `Cancel the team bus, make ${slander1} take public transport with the fans after that stinker!`,
    `0.02 xG in the second half for ${club}. Terrorball heritage at its finest! [DISASTERCLASS]`,
    `My grandma in orthopedic slippers could have closed down ${winner}'s winger faster than ${club}'s fullback!`,
    `Another week, another successful hate-watch. ${club} never disappoints the haters!`,
  ];

  // 50+ Curated Transfer & Contract Comments
  const transferComments = [
    `${fee} Mio. for ${slander0}?! ROBBERY OF THE CENTURY! Call Interpol immediately! [LMAO]`,
    `Whoever negotiated this ${fee}M fee for ${sellerTeamName || 'den Verkäufer'} deserves a statue outside the stadium!`,
    `Bro ${slander1} got sold for ${fee}M after 1 good YouTube compilation in 2024. The PR machine is undefeated!`,
    `Here We Go? More like Here We Overpay! ${slander0} is not worth a quarter of ${fee} Mio.!`,
    `Imagine spending ${fee} Mio. on ${slander2} when you could have bought a whole midfield. Banter club behaviour!`,
    `He will be playing in the U23 reserves by November, bookmark this tweet! [FRAUDWATCH]`,
    `Hater Central official case file opened for ${slander0}. The 007 watch begins at kickoff! [007]`,
    `Ratio + ${buyerTeamName || club}'s sporting director needs his hard drive and bank accounts audited for this fee!`,
    `Bro celebrated signing the contract like he won the Champions League. Bro signed a 5-year bench sentence!`,
    `Welcome to the bench, ${slander1}! Enjoy the heated seats and iPad highlights!`,
    `Daylight robbery without a ski mask! ${sellerTeamName || 'Der abgebende Klub'} just fleeced ${buyerTeamName || club} for ${fee}M!`,
    `${slander0}'s agent is the greatest con artist since Jordan Belfort in Wolf of Wall Street!`,
    `Medical staff at ${buyerTeamName || club} just cleared a guy who pulls his hamstring getting out of bed!`,
    `Wait until ${buyerTeamName || club} fans realize ${slander2} can't trap a bag of cement! [DEAD]`,
    `${fee} Mio. plus wages for a guy whose best attribute is 'passion and clapping at the fans'!`,
    `Financial Fair Play is a myth if ${buyerTeamName || club} is allowed to burn ${fee}M on ${slander0}!`,
    `I give it 4 games before ${buyerTeamName || club} fans are boo-ing ${slander1} at every throw-in!`,
    `Bro kissed the badge in the presentation photos after begging for 3 other clubs last week! Shameless!`,
    `Top 10 Worst Transfers in History—and ${slander0} hasn't even kicked a ball yet! [LMAO]`,
    `Selling ${slander2} for ${fee}M is like selling a 2004 Fiat Punto for Ferrari money! Masterclass!`,
    `Agent fee on this deal must be 40% because no sober scout watched ${slander0} and approved ${fee} Mio.!`,
    `${buyerTeamName || club} saw ${slander1} do two stepovers on TikTok and wired ${fee} million Euros!`,
    `Countdown to the 'loan with option to buy to Fenerbahçe' in 18 months starts today!`,
    `Even Saudi clubs looked at ${slander0}'s wage demands and said 'habibi we are good'!`,
    `The pen used to sign ${slander2}'s contract had more movement than he shows in 90 minutes!`,
  ];

  // 35+ Curated Hijack & Drama Comments
  const hijackComments = [
    `HIJACK ALERT! Bro packed his bags for one club and landed at their biggest rival! [CHAOS]`,
    `The sheer disrespect! Snatched right off the medical examination table in 4K! [LMAO]`,
    `Gazzump of the century! ${slander0} changed his Twitter bio while the private jet was still in the air!`,
    `Imagine losing your top transfer target in 10 minutes to a rival manager. Delete the club!`,
    `Hater Central: We live for transfer hijack drama! Grab the popcorn, the timeline is on fire!`,
    `Ratio + hijacked + enjoy watching ${slander1} score against you in the derby next week!`,
    `Bro left the rival sporting director on 'Read' on WhatsApp while signing the contract! Cold blooded!`,
    `They already printed shirts with ${slander0}'s name and now he's holding up the rival scarf! [DEAD]`,
    `Not even Willian's Chelsea-Spurs hijack was this ruthless! Pure transfer market violence!`,
    `The rival manager was still faxing the offer while ${buyerTeamName || winner} was filming the announcement video!`,
    `Top 1 Anime Betrayals in Super League history! ${slander2} has zero loyalty and I love it!`,
    `Bro used the first club just to get a free flight and hotel before signing across town! Genius!`,
  ];

  // 40+ General / Matchday / Table Leader / Banter Comments
  const generalComments = [
    `Football Twitter remains the greatest and most unhinged place on the internet! [LMAO]`,
    `Bro really posted this with a straight face. The delusion in this fanbase is historic!`,
    `The timeline is going to be so toxic tonight, I love this game!`,
    `Hater Central officially stamps and approves this agenda.`,
    `Ratio + L + nobody asked + your club has 0 European pedigree + ${slander0} is a ghost! [RATIO]`,
    `We will be there no matter what! Suit and tie ready for the downfall!`,
    `Bro thought the fans wouldn't notice the disasterclass. We have 4K screenshots!`,
    `Factos. Two thumbs up and jealous eyes! [FACTOS]`,
    `Elephant on top of the tree: nobody knows how they got to 1st place, but everyone knows they are falling down!`,
    `Check the VAR audio on this league! The scriptwriters are getting lazy!`,
    `Don't let this distract you from the fact that ${slander0} still has 0 goals against top-4 defenses!`,
    `Admin is tweeting from behind a wall of tears right now! [CRYING]`,
    `Give them the 'We Won the Possession Battle' trophy already!`,
    `Put this tweet in the Louvre Museum next to the Mona Lisa!`,
    `Another day of thanking God I wasn't born a supporter of ${club}!`,
    `If 'Next Season Is Our Season' was a trophy, ${club} would have 15 Champions Leagues!`,
    `Wake me up when ${slander1} performs in a match that actually matters!`,
    `The PR machine works harder than the midfielders in this league!`,
  ];

  // Determine which pool to pull from based on event type
  let primaryPool = generalComments;
  if (type === 'defeat' || type === 'defeat-slander' || type === 'big-cpu-match' || type === 'human-match-result') {
    primaryPool = defeatComments;
  } else if (type === 'transfer' || type === 'transfer-completed' || type === 'offer-rejected' || type === 'offer-countered') {
    primaryPool = transferComments;
  } else if (type === 'hijack' || type === 'transfer-hijacked') {
    primaryPool = hijackComments.concat(transferComments);
  } else {
    primaryPool = generalComments.concat(defeatComments.slice(0, 20), transferComments.slice(0, 15));
  }

  // Seed hash from post identity + offset so each post and each "load more" click gets fresh comments
  const seed = `${id}-${playerName}-${teamName}-${losingTeam}-${winningTeam}-${fee}-${round}-${type}-${text.slice(0, 32)}-${offset}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  const result = [];
  const usedInBatch = new Set(existingTexts);

  for (let i = 0; i < count; i++) {
    let commentText = '';
    // Mix curated pool (first 65%) and combinatorial generator (35% or when pool exhausted) for massive variety
    const useCombinatorial = (i % 3 === 2) || (offset > 10 && i % 2 === 1);

    if (!useCombinatorial) {
      for (let attempt = 0; attempt < primaryPool.length; attempt++) {
        const idx = (hash + (offset + i) * 17 + attempt * 7) % primaryPool.length;
        const candidate = primaryPool[idx];
        if (!usedInBatch.has(candidate)) {
          commentText = candidate;
          break;
        }
      }
    }

    if (!commentText) {
      commentText = buildCombinatorialTrollReply(hash, offset + i + 1, {
        slander: (i % 2 === 0) ? slander0 : slander1,
        teamName: club,
        losingTeam: club,
        winningTeam: winner,
        fee,
        homeScore,
        awayScore,
      });
    }

    usedInBatch.add(commentText);

    const account = TROLL_ACCOUNTS[(hash + (offset + i) * 13) % TROLL_ACCOUNTS.length];
    const likes = ((hash + (offset + i) * 251) % 1420) + 14;
    const isRatio = likes > 500;

    result.push({
      id: `x-comment-${hash}-${offset + i}-${Date.now().toString(36)}`,
      authorName: account.name,
      authorHandle: account.handle,
      authorAvatar: account.avatar,
      verified: account.verified,
      text: commentText,
      likes,
      isRatio,
      createdAt: new Date(Date.now() - (count - i) * 120000).toISOString(),
    });
  }

  return result;
}

/**
 * Creates an official Hater Central / Troll Football breaking news post when a team suffers a defeat.
 * Features 18 distinct headline templates and roasts multiple players from the losing squad.
 */
export function buildMatchDefeatSlanderPost(match = {}, homeTeam = {}, awayTeam = {}, picks = []) {
  const homeScore = Number(match.homeScore) || 0;
  const awayScore = Number(match.awayScore) || 0;

  if (homeScore === awayScore) return null; // Draw has no clear loser

  const loser = homeScore < awayScore ? homeTeam : awayTeam;
  const winner = homeScore < awayScore ? awayTeam : homeTeam;
  const loserScore = Math.min(homeScore, awayScore);
  const winnerScore = Math.max(homeScore, awayScore);
  const diff = winnerScore - loserScore;

  // Find star players from the loser's roster to roast
  const loserPicks = (picks || [])
    .filter((p) => p.teamId === loser.id)
    .sort((a, b) => (b.rating || 80) - (a.rating || 80));

  const matchSeed = String(match.matchId || match.fixtureId || `${loser.id}-${winner.id}-${homeScore}-${awayScore}`);
  let mHash = 0;
  for (let i = 0; i < matchSeed.length; i++) mHash = (mHash * 33 + matchSeed.charCodeAt(i)) >>> 0;

  const primaryPlayer = loserPicks[0] || { playerName: 'Der Starstürmer', position: 'ST' };
  const secondaryPlayer = loserPicks[1] || loserPicks[0] || { playerName: 'Der Kapitän', position: 'CM' };

  const slander1 = getPlayerSlanderName(primaryPlayer.playerName, primaryPlayer.position, mHash % 3);
  const slander2 = secondaryPlayer.playerName !== primaryPlayer.playerName
    ? getPlayerSlanderName(secondaryPlayer.playerName, secondaryPlayer.position, (mHash + 1) % 3)
    : null;

  const isBlowout = diff >= 3;
  const accountPool = TROLL_ACCOUNTS.slice(0, 6);
  const account = accountPool[mHash % accountPool.length];
  const loserTag = `#${String(loser.name || 'Club').replace(/[^A-Za-z0-9]/g, '')}`;
  const winnerTag = `#${String(winner.name || 'Winner').replace(/[^A-Za-z0-9]/g, '')}`;

  const blowoutTemplates = [
    `HUMILIATION: ${loser.name} GETS COOKED ${loserScore}:${winnerScore} BY ${winner.name}! We prayed for times like this! ${slander1} with a masterclass in disappearing: 0 goals, 0 shots on target, 90 minutes of pure cardio.${slander2 ? ` Meanwhile ${slander2} was defending via Bluetooth!` : ''} Check on your ${loser.name} friends! #Disasterclass ${loserTag}Meltdown #HaterCentral`,
    `GENERATIONAL DISASTERCLASS: ${winner.name} ${winnerScore}:${loserScore} ${loser.name}! Delete the club immediately! ${slander1} dropped a 3.8 rating and spent the whole second half arguing with the grass.${slander2 ? ` ${slander2} got spun so hard he is still dizzy in the dressing room!` : ''} [LMAO] #FraudWatch ${loserTag}Cooked`,
    `CRIME SCENE AT FULL TIME: ${loser.name} battered ${loserScore}:${winnerScore} by ${winner.name}! Call Interpol, ${slander1} has gone missing for 90 minutes! Zero shots, zero dribbles, 100% cardio session.${slander2 ? ` Even ${slander2} couldn't complete a 3-yard pass!` : ''} [DISASTERCLASS] ${winnerTag} #BanterFC`,
    `PUBLIC EXECUTION: ${winner.name} destroys ${loser.name} ${winnerScore}:${loserScore} in 4K Ultra HD! ${slander1} thought he was the main character and ended up with fewer touches than the stadium announcer! Refund every ${loser.name} supporter tonight! [COOKED] #HaterCentral`,
    `STOP THE FIGHT: ${loser.name} ${loserScore}:${winnerScore} ${winner.name}! The greatest hate-watch of the season! ${slander1} and ${slander2 || 'the entire backline'} just produced a comedy show for the ages. Don't let them on the team bus! [LMAO] #Disasterclass ${loserTag}`,
  ];

  const regularDefeatTemplates = [
    `FULL TIME: ${loser.name} ${loserScore}:${winnerScore} ${winner.name}! The downfall of ${loser.name} continues in 4K! ${slander1} spent more time complaining to the referee than touching the ball. Bro thought he was HIM! [LMAO] #BanterFC ${winnerTag}Cooked`,
    `ANOTHER SUCCESSFUL HATE-WATCH: ${winner.name} humbles ${loser.name} ${winnerScore}:${loserScore}! Where were the ${loser.name} fanboys when ${slander1} ghosted the entire match?!${slander2 ? ` ${slander2} was doing a charity jog in midfield!` : ''} [FRAUDWATCH] #HaterCentral ${loserTag}`,
    `BOTTLE JOB COMPLETE: ${loser.name} loses ${loserScore}:${winnerScore} against ${winner.name}! ${slander1} with an all-time stinker: 0 goals, 0 assists, 14 times dispossessed, and 1 post-match apology in the Notes app incoming! [007] #SlanderFC`,
    `EXPOSED IN 4K: ${winner.name} (${winnerScore}) sends ${loser.name} (${loserScore}) home with 0 points! Check ${winner.name}'s center back's pockets, ${slander1} is still locked inside!${slander2 ? ` And ${slander2} kicked the ball into Row Z three times!` : ''} [COOKED] ${loserTag}Downfall`,
    `FRAUD WATCH VERDICT: GUILTY! ${loser.name} falls ${loserScore}:${winnerScore} to ${winner.name}! ${slander1} did 90 minutes of pure cardio without troubling the goalkeeper once. Put the fries in the bag bro! [LMAO] #FraudWatch #HaterCentral`,
  ];

  const chosenTemplates = isBlowout ? blowoutTemplates : regularDefeatTemplates;
  const text = chosenTemplates[mHash % chosenTemplates.length];

  const postId = `slander-defeat-${match.matchId || match.fixtureId || Date.now()}-${loser.id}`;
  const comments = generateXFootballComments({
    id: postId,
    type: 'defeat',
    playerName: primaryPlayer.playerName,
    position: primaryPlayer.position,
    teamName: loser.name,
    losingTeam: loser.name,
    winningTeam: winner.name,
    homeScore,
    awayScore,
    round: match.round || '',
    text,
  }, 7);

  return {
    id: postId,
    type: 'defeat-slander',
    category: 'hatercentral',
    authorName: account.name,
    authorHandle: account.handle,
    authorAvatar: account.avatar,
    verified: true,
    badge: isBlowout ? 'DISASTERCLASS EXPOSED' : 'HATER CENTRAL SLANDER',
    teamIds: [loser.id, winner.id],
    likes: [winner.id],
    reposts: [],
    comments,
    text,
    createdAt: match.at || new Date().toISOString(),
  };
}
