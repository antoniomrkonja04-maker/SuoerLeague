export const seedTeams = [
  ['eng', 'Manchester City', 'England'], ['eng', 'Arsenal', 'England'], ['eng', 'Liverpool', 'England'],
  ['eng', 'Chelsea', 'England'], ['eng', 'Manchester United', 'England'], ['eng', 'Tottenham Hotspur', 'England'],
  ['esp', 'Real Madrid', 'Spanien'], ['esp', 'FC Barcelona', 'Spanien'], ['esp', 'Atlético Madrid', 'Spanien'],
  ['esp', 'Athletic Club', 'Spanien'], ['esp', 'Real Sociedad', 'Spanien'], ['esp', 'Villarreal CF', 'Spanien'],
  ['ita', 'Inter Mailand', 'Italien'], ['ita', 'AC Mailand', 'Italien'], ['ita', 'Juventus Turin', 'Italien'],
  ['ita', 'SSC Neapel', 'Italien'], ['ita', 'AS Rom', 'Italien'], ['ita', 'Atalanta Bergamo', 'Italien'],
  ['ger', 'Bayern München', 'Deutschland'], ['ger', 'Borussia Dortmund', 'Deutschland'], ['ger', 'Bayer 04 Leverkusen', 'Deutschland'],
  ['ger', 'RB Leipzig', 'Deutschland'], ['ger', 'VfB Stuttgart', 'Deutschland'], ['ger', 'Eintracht Frankfurt', 'Deutschland'],
  ['fra', 'Paris Saint-Germain', 'Frankreich'], ['fra', 'Olympique Marseille', 'Frankreich'], ['fra', 'AS Monaco', 'Frankreich'],
  ['fra', 'LOSC Lille', 'Frankreich'], ['fra', 'Olympique Lyonnais', 'Frankreich'], ['fra', 'OGC Nizza', 'Frankreich'],
].map(([country, name, league], index) => ({
  id: `club-${index + 1}`,
  country,
  name,
  league,
  custom: false,
}));
