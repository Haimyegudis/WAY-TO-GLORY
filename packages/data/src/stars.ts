import type { StarPlayerSeed } from '@fc/engine';

/**
 * Real named players for the biggest clubs, so the world the career starts in has
 * faces the player recognises. Everyone else in the world is generated.
 *
 * Accurate to roughly the 2025/26 season. Squads move on and this list will drift;
 * it is data, so it can be corrected without touching the engine. Ratings are
 * judgement calls, not an official rating system.
 */
export const STARS: StarPlayerSeed[] = [
  // Real Madrid
  { clubId: 'esp_real_madrid_cf', firstName: 'Thibaut', lastName: 'Courtois', pos: 'GK', ovr: 89, age: 33, country: 'BEL' },
  { clubId: 'esp_real_madrid_cf', firstName: 'Eder', lastName: 'Militao', pos: 'CB', ovr: 84, age: 27, country: 'BRA' },
  { clubId: 'esp_real_madrid_cf', firstName: 'Dean', lastName: 'Huijsen', pos: 'CB', ovr: 80, age: 20, country: 'ESP', potential: 89 },
  { clubId: 'esp_real_madrid_cf', firstName: 'Alvaro', lastName: 'Carreras', pos: 'LB', ovr: 80, age: 22, country: 'ESP' },
  { clubId: 'esp_real_madrid_cf', firstName: 'Federico', lastName: 'Valverde', pos: 'CM', ovr: 89, age: 27, country: 'URU' },
  { clubId: 'esp_real_madrid_cf', firstName: 'Jude', lastName: 'Bellingham', pos: 'CAM', ovr: 89, age: 22, country: 'ENG', potential: 94 },
  { clubId: 'esp_real_madrid_cf', firstName: 'Kylian', lastName: 'Mbappe', pos: 'ST', ovr: 92, age: 26, country: 'FRA' },
  { clubId: 'esp_real_madrid_cf', firstName: 'Vinicius', lastName: 'Junior', pos: 'LW', ovr: 90, age: 25, country: 'BRA' },

  // Barcelona
  { clubId: 'esp_fc_barcelona', firstName: 'Joan', lastName: 'Garcia', pos: 'GK', ovr: 82, age: 24, country: 'ESP' },
  { clubId: 'esp_fc_barcelona', firstName: 'Pau', lastName: 'Cubarsi', pos: 'CB', ovr: 82, age: 18, country: 'ESP', potential: 91 },
  { clubId: 'esp_fc_barcelona', firstName: 'Ronald', lastName: 'Araujo', pos: 'CB', ovr: 84, age: 26, country: 'URU' },
  { clubId: 'esp_fc_barcelona', firstName: 'Alejandro', lastName: 'Balde', pos: 'LB', ovr: 81, age: 22, country: 'ESP' },
  { clubId: 'esp_fc_barcelona', firstName: 'Pedri', lastName: 'Gonzalez', pos: 'CM', ovr: 88, age: 22, country: 'ESP', potential: 92 },
  { clubId: 'esp_fc_barcelona', firstName: 'Frenkie', lastName: 'de Jong', pos: 'CM', ovr: 86, age: 28, country: 'NED' },
  { clubId: 'esp_fc_barcelona', firstName: 'Lamine', lastName: 'Yamal', pos: 'RW', ovr: 89, age: 18, country: 'ESP', potential: 96 },
  { clubId: 'esp_fc_barcelona', firstName: 'Raphinha', lastName: 'Dias', pos: 'LW', ovr: 87, age: 28, country: 'BRA' },
  { clubId: 'esp_fc_barcelona', firstName: 'Robert', lastName: 'Lewandowski', pos: 'ST', ovr: 85, age: 37, country: 'POL' },

  // Atletico Madrid
  { clubId: 'esp_club_atletico_de_madrid', firstName: 'Jan', lastName: 'Oblak', pos: 'GK', ovr: 85, age: 32, country: 'SVN' },
  { clubId: 'esp_club_atletico_de_madrid', firstName: 'Jose', lastName: 'Gimenez', pos: 'CB', ovr: 83, age: 30, country: 'URU' },
  { clubId: 'esp_club_atletico_de_madrid', firstName: 'Robin', lastName: 'Le Normand', pos: 'CB', ovr: 82, age: 28, country: 'ESP' },
  { clubId: 'esp_club_atletico_de_madrid', firstName: 'David', lastName: 'Hancko', pos: 'LB', ovr: 82, age: 27, country: 'SVK' },
  { clubId: 'esp_club_atletico_de_madrid', firstName: 'Pablo', lastName: 'Barrios', pos: 'CM', ovr: 81, age: 22, country: 'ESP', potential: 88 },
  { clubId: 'esp_club_atletico_de_madrid', firstName: 'Giuliano', lastName: 'Simeone', pos: 'RW', ovr: 80, age: 23, country: 'ARG' },
  { clubId: 'esp_club_atletico_de_madrid', firstName: 'Antoine', lastName: 'Griezmann', pos: 'CF', ovr: 85, age: 34, country: 'FRA' },
  { clubId: 'esp_club_atletico_de_madrid', firstName: 'Julian', lastName: 'Alvarez', pos: 'ST', ovr: 87, age: 25, country: 'ARG' },

  // Bayern Munich
  { clubId: 'ger_fc_bayern_munchen', firstName: 'Manuel', lastName: 'Neuer', pos: 'GK', ovr: 86, age: 39, country: 'GER' },
  { clubId: 'ger_fc_bayern_munchen', firstName: 'Dayot', lastName: 'Upamecano', pos: 'CB', ovr: 85, age: 27, country: 'FRA' },
  { clubId: 'ger_fc_bayern_munchen', firstName: 'Minjae', lastName: 'Kim', pos: 'CB', ovr: 83, age: 29, country: 'KOR' },
  { clubId: 'ger_fc_bayern_munchen', firstName: 'Alphonso', lastName: 'Davies', pos: 'LB', ovr: 84, age: 25, country: 'CAN' },
  { clubId: 'ger_fc_bayern_munchen', firstName: 'Joshua', lastName: 'Kimmich', pos: 'CM', ovr: 88, age: 30, country: 'GER' },
  { clubId: 'ger_fc_bayern_munchen', firstName: 'Jamal', lastName: 'Musiala', pos: 'CAM', ovr: 88, age: 22, country: 'GER', potential: 93 },
  { clubId: 'ger_fc_bayern_munchen', firstName: 'Michael', lastName: 'Olise', pos: 'RW', ovr: 87, age: 24, country: 'FRA' },
  { clubId: 'ger_fc_bayern_munchen', firstName: 'Harry', lastName: 'Kane', pos: 'ST', ovr: 91, age: 32, country: 'ENG' },

  // Borussia Dortmund
  { clubId: 'ger_borussia_dortmund', firstName: 'Gregor', lastName: 'Kobel', pos: 'GK', ovr: 84, age: 28, country: 'SUI' },
  { clubId: 'ger_borussia_dortmund', firstName: 'Nico', lastName: 'Schlotterbeck', pos: 'CB', ovr: 84, age: 26, country: 'GER' },
  { clubId: 'ger_borussia_dortmund', firstName: 'Waldemar', lastName: 'Anton', pos: 'CB', ovr: 79, age: 29, country: 'GER' },
  { clubId: 'ger_borussia_dortmund', firstName: 'Julian', lastName: 'Ryerson', pos: 'RB', ovr: 77, age: 28, country: 'NOR' },
  { clubId: 'ger_borussia_dortmund', firstName: 'Marcel', lastName: 'Sabitzer', pos: 'CM', ovr: 80, age: 31, country: 'AUT' },
  { clubId: 'ger_borussia_dortmund', firstName: 'Julian', lastName: 'Brandt', pos: 'CAM', ovr: 82, age: 29, country: 'GER' },
  { clubId: 'ger_borussia_dortmund', firstName: 'Karim', lastName: 'Adeyemi', pos: 'LW', ovr: 81, age: 23, country: 'GER' },
  { clubId: 'ger_borussia_dortmund', firstName: 'Serhou', lastName: 'Guirassy', pos: 'ST', ovr: 85, age: 29, country: 'GUI' },

  // Bayer Leverkusen
  { clubId: 'ger_bayer_04_leverkusen', firstName: 'Mark', lastName: 'Flekken', pos: 'GK', ovr: 79, age: 32, country: 'NED' },
  { clubId: 'ger_bayer_04_leverkusen', firstName: 'Edmond', lastName: 'Tapsoba', pos: 'CB', ovr: 82, age: 26, country: 'BFA' },
  { clubId: 'ger_bayer_04_leverkusen', firstName: 'Jarell', lastName: 'Quansah', pos: 'CB', ovr: 79, age: 22, country: 'ENG' },
  { clubId: 'ger_bayer_04_leverkusen', firstName: 'Alejandro', lastName: 'Grimaldo', pos: 'LB', ovr: 84, age: 30, country: 'ESP' },
  { clubId: 'ger_bayer_04_leverkusen', firstName: 'Robert', lastName: 'Andrich', pos: 'CDM', ovr: 80, age: 31, country: 'GER' },
  { clubId: 'ger_bayer_04_leverkusen', firstName: 'Malik', lastName: 'Tillman', pos: 'CAM', ovr: 81, age: 23, country: 'USA' },
  { clubId: 'ger_bayer_04_leverkusen', firstName: 'Patrik', lastName: 'Schick', pos: 'ST', ovr: 84, age: 29, country: 'CZE' },

  // RB Leipzig
  { clubId: 'ger_rb_leipzig', firstName: 'Peter', lastName: 'Gulacsi', pos: 'GK', ovr: 81, age: 35, country: 'HUN' },
  { clubId: 'ger_rb_leipzig', firstName: 'Willi', lastName: 'Orban', pos: 'CB', ovr: 80, age: 32, country: 'HUN' },
  { clubId: 'ger_rb_leipzig', firstName: 'Castello', lastName: 'Lukeba', pos: 'CB', ovr: 82, age: 23, country: 'FRA' },
  { clubId: 'ger_rb_leipzig', firstName: 'David', lastName: 'Raum', pos: 'LB', ovr: 80, age: 27, country: 'GER' },
  { clubId: 'ger_rb_leipzig', firstName: 'Christoph', lastName: 'Baumgartner', pos: 'CAM', ovr: 79, age: 26, country: 'AUT' },
  { clubId: 'ger_rb_leipzig', firstName: 'Antonio', lastName: 'Nusa', pos: 'LW', ovr: 79, age: 20, country: 'NOR', potential: 87 },
  { clubId: 'ger_rb_leipzig', firstName: 'Lois', lastName: 'Openda', pos: 'ST', ovr: 81, age: 25, country: 'BEL' },

  // Liverpool
  { clubId: 'eng_liverpool_fc', firstName: 'Alisson', lastName: 'Becker', pos: 'GK', ovr: 88, age: 33, country: 'BRA' },
  { clubId: 'eng_liverpool_fc', firstName: 'Virgil', lastName: 'van Dijk', pos: 'CB', ovr: 88, age: 34, country: 'NED' },
  { clubId: 'eng_liverpool_fc', firstName: 'Ibrahima', lastName: 'Konate', pos: 'CB', ovr: 84, age: 26, country: 'FRA' },
  { clubId: 'eng_liverpool_fc', firstName: 'Milos', lastName: 'Kerkez', pos: 'LB', ovr: 80, age: 22, country: 'HUN' },
  { clubId: 'eng_liverpool_fc', firstName: 'Ryan', lastName: 'Gravenberch', pos: 'CM', ovr: 85, age: 23, country: 'NED' },
  { clubId: 'eng_liverpool_fc', firstName: 'Florian', lastName: 'Wirtz', pos: 'CAM', ovr: 88, age: 22, country: 'GER', potential: 93 },
  { clubId: 'eng_liverpool_fc', firstName: 'Mohamed', lastName: 'Salah', pos: 'RW', ovr: 89, age: 33, country: 'EGY' },
  { clubId: 'eng_liverpool_fc', firstName: 'Alexander', lastName: 'Isak', pos: 'ST', ovr: 87, age: 26, country: 'SWE' },

  // Manchester City
  { clubId: 'eng_manchester_city_fc', firstName: 'Gianluigi', lastName: 'Donnarumma', pos: 'GK', ovr: 88, age: 26, country: 'ITA' },
  { clubId: 'eng_manchester_city_fc', firstName: 'Ruben', lastName: 'Dias', pos: 'CB', ovr: 87, age: 28, country: 'POR' },
  { clubId: 'eng_manchester_city_fc', firstName: 'Josko', lastName: 'Gvardiol', pos: 'CB', ovr: 85, age: 23, country: 'CRO' },
  { clubId: 'eng_manchester_city_fc', firstName: 'Rodri', lastName: 'Hernandez', pos: 'CDM', ovr: 90, age: 29, country: 'ESP' },
  { clubId: 'eng_manchester_city_fc', firstName: 'Tijjani', lastName: 'Reijnders', pos: 'CM', ovr: 84, age: 27, country: 'NED' },
  { clubId: 'eng_manchester_city_fc', firstName: 'Phil', lastName: 'Foden', pos: 'CAM', ovr: 86, age: 25, country: 'ENG' },
  { clubId: 'eng_manchester_city_fc', firstName: 'Jeremy', lastName: 'Doku', pos: 'LW', ovr: 83, age: 23, country: 'BEL' },
  { clubId: 'eng_manchester_city_fc', firstName: 'Erling', lastName: 'Haaland', pos: 'ST', ovr: 92, age: 25, country: 'NOR' },

  // Arsenal
  { clubId: 'eng_arsenal_fc', firstName: 'David', lastName: 'Raya', pos: 'GK', ovr: 85, age: 30, country: 'ESP' },
  { clubId: 'eng_arsenal_fc', firstName: 'William', lastName: 'Saliba', pos: 'CB', ovr: 87, age: 24, country: 'FRA' },
  { clubId: 'eng_arsenal_fc', firstName: 'Gabriel', lastName: 'Magalhaes', pos: 'CB', ovr: 86, age: 28, country: 'BRA' },
  { clubId: 'eng_arsenal_fc', firstName: 'Jurrien', lastName: 'Timber', pos: 'RB', ovr: 83, age: 24, country: 'NED' },
  { clubId: 'eng_arsenal_fc', firstName: 'Declan', lastName: 'Rice', pos: 'CM', ovr: 88, age: 26, country: 'ENG' },
  { clubId: 'eng_arsenal_fc', firstName: 'Martin', lastName: 'Odegaard', pos: 'CAM', ovr: 87, age: 26, country: 'NOR' },
  { clubId: 'eng_arsenal_fc', firstName: 'Bukayo', lastName: 'Saka', pos: 'RW', ovr: 87, age: 24, country: 'ENG' },
  { clubId: 'eng_arsenal_fc', firstName: 'Viktor', lastName: 'Gyokeres', pos: 'ST', ovr: 85, age: 27, country: 'SWE' },

  // Chelsea
  { clubId: 'eng_chelsea_fc', firstName: 'Robert', lastName: 'Sanchez', pos: 'GK', ovr: 81, age: 28, country: 'ESP' },
  { clubId: 'eng_chelsea_fc', firstName: 'Levi', lastName: 'Colwill', pos: 'CB', ovr: 82, age: 22, country: 'ENG' },
  { clubId: 'eng_chelsea_fc', firstName: 'Marc', lastName: 'Cucurella', pos: 'LB', ovr: 83, age: 27, country: 'ESP' },
  { clubId: 'eng_chelsea_fc', firstName: 'Moises', lastName: 'Caicedo', pos: 'CDM', ovr: 87, age: 24, country: 'ECU' },
  { clubId: 'eng_chelsea_fc', firstName: 'Enzo', lastName: 'Fernandez', pos: 'CM', ovr: 85, age: 24, country: 'ARG' },
  { clubId: 'eng_chelsea_fc', firstName: 'Cole', lastName: 'Palmer', pos: 'CAM', ovr: 88, age: 23, country: 'ENG', potential: 92 },
  { clubId: 'eng_chelsea_fc', firstName: 'Pedro', lastName: 'Neto', pos: 'LW', ovr: 80, age: 25, country: 'POR' },
  { clubId: 'eng_chelsea_fc', firstName: 'Joao', lastName: 'Pedro', pos: 'ST', ovr: 82, age: 24, country: 'BRA' },

  // Manchester United
  { clubId: 'eng_manchester_united_fc', firstName: 'Altay', lastName: 'Bayindir', pos: 'GK', ovr: 76, age: 27, country: 'TUR' },
  { clubId: 'eng_manchester_united_fc', firstName: 'Matthijs', lastName: 'de Ligt', pos: 'CB', ovr: 83, age: 26, country: 'NED' },
  { clubId: 'eng_manchester_united_fc', firstName: 'Luke', lastName: 'Shaw', pos: 'LB', ovr: 78, age: 30, country: 'ENG' },
  { clubId: 'eng_manchester_united_fc', firstName: 'Casemiro', lastName: 'Silva', pos: 'CDM', ovr: 80, age: 33, country: 'BRA' },
  { clubId: 'eng_manchester_united_fc', firstName: 'Bruno', lastName: 'Fernandes', pos: 'CAM', ovr: 87, age: 31, country: 'POR' },
  { clubId: 'eng_manchester_united_fc', firstName: 'Bryan', lastName: 'Mbeumo', pos: 'RW', ovr: 83, age: 26, country: 'CMR' },
  { clubId: 'eng_manchester_united_fc', firstName: 'Matheus', lastName: 'Cunha', pos: 'CF', ovr: 82, age: 26, country: 'BRA' },
  { clubId: 'eng_manchester_united_fc', firstName: 'Benjamin', lastName: 'Sesko', pos: 'ST', ovr: 82, age: 22, country: 'SVN', potential: 89 },

  // Tottenham
  { clubId: 'eng_tottenham_hotspur_fc', firstName: 'Guglielmo', lastName: 'Vicario', pos: 'GK', ovr: 82, age: 29, country: 'ITA' },
  { clubId: 'eng_tottenham_hotspur_fc', firstName: 'Cristian', lastName: 'Romero', pos: 'CB', ovr: 85, age: 27, country: 'ARG' },
  { clubId: 'eng_tottenham_hotspur_fc', firstName: 'Micky', lastName: 'van de Ven', pos: 'CB', ovr: 84, age: 24, country: 'NED' },
  { clubId: 'eng_tottenham_hotspur_fc', firstName: 'Destiny', lastName: 'Udogie', pos: 'LB', ovr: 80, age: 23, country: 'ITA' },
  { clubId: 'eng_tottenham_hotspur_fc', firstName: 'Pape', lastName: 'Sarr', pos: 'CM', ovr: 79, age: 23, country: 'SEN' },
  { clubId: 'eng_tottenham_hotspur_fc', firstName: 'James', lastName: 'Maddison', pos: 'CAM', ovr: 82, age: 29, country: 'ENG' },
  { clubId: 'eng_tottenham_hotspur_fc', firstName: 'Mohammed', lastName: 'Kudus', pos: 'RW', ovr: 82, age: 25, country: 'GHA' },
  { clubId: 'eng_tottenham_hotspur_fc', firstName: 'Dominic', lastName: 'Solanke', pos: 'ST', ovr: 80, age: 28, country: 'ENG' },

  // Newcastle
  { clubId: 'eng_newcastle_united_fc', firstName: 'Nick', lastName: 'Pope', pos: 'GK', ovr: 80, age: 33, country: 'ENG' },
  { clubId: 'eng_newcastle_united_fc', firstName: 'Sven', lastName: 'Botman', pos: 'CB', ovr: 82, age: 25, country: 'NED' },
  { clubId: 'eng_newcastle_united_fc', firstName: 'Fabian', lastName: 'Schar', pos: 'CB', ovr: 80, age: 34, country: 'SUI' },
  { clubId: 'eng_newcastle_united_fc', firstName: 'Bruno', lastName: 'Guimaraes', pos: 'CM', ovr: 86, age: 28, country: 'BRA' },
  { clubId: 'eng_newcastle_united_fc', firstName: 'Sandro', lastName: 'Tonali', pos: 'CM', ovr: 84, age: 25, country: 'ITA' },
  { clubId: 'eng_newcastle_united_fc', firstName: 'Anthony', lastName: 'Gordon', pos: 'LW', ovr: 82, age: 24, country: 'ENG' },
  { clubId: 'eng_newcastle_united_fc', firstName: 'Nick', lastName: 'Woltemade', pos: 'ST', ovr: 81, age: 23, country: 'GER' },

  // Inter
  { clubId: 'ita_fc_internazionale_milano', firstName: 'Yann', lastName: 'Sommer', pos: 'GK', ovr: 83, age: 37, country: 'SUI' },
  { clubId: 'ita_fc_internazionale_milano', firstName: 'Alessandro', lastName: 'Bastoni', pos: 'CB', ovr: 86, age: 26, country: 'ITA' },
  { clubId: 'ita_fc_internazionale_milano', firstName: 'Benjamin', lastName: 'Pavard', pos: 'CB', ovr: 81, age: 29, country: 'FRA' },
  { clubId: 'ita_fc_internazionale_milano', firstName: 'Federico', lastName: 'Dimarco', pos: 'LWB', ovr: 85, age: 28, country: 'ITA' },
  { clubId: 'ita_fc_internazionale_milano', firstName: 'Nicolo', lastName: 'Barella', pos: 'CM', ovr: 86, age: 28, country: 'ITA' },
  { clubId: 'ita_fc_internazionale_milano', firstName: 'Hakan', lastName: 'Calhanoglu', pos: 'CDM', ovr: 85, age: 31, country: 'TUR' },
  { clubId: 'ita_fc_internazionale_milano', firstName: 'Marcus', lastName: 'Thuram', pos: 'ST', ovr: 86, age: 28, country: 'FRA' },
  { clubId: 'ita_fc_internazionale_milano', firstName: 'Lautaro', lastName: 'Martinez', pos: 'ST', ovr: 88, age: 28, country: 'ARG' },

  // AC Milan
  { clubId: 'ita_ac_milan', firstName: 'Mike', lastName: 'Maignan', pos: 'GK', ovr: 85, age: 30, country: 'FRA' },
  { clubId: 'ita_ac_milan', firstName: 'Fikayo', lastName: 'Tomori', pos: 'CB', ovr: 81, age: 28, country: 'ENG' },
  { clubId: 'ita_ac_milan', firstName: 'Strahinja', lastName: 'Pavlovic', pos: 'CB', ovr: 79, age: 24, country: 'SRB' },
  { clubId: 'ita_ac_milan', firstName: 'Luka', lastName: 'Modric', pos: 'CM', ovr: 82, age: 40, country: 'CRO' },
  { clubId: 'ita_ac_milan', firstName: 'Youssouf', lastName: 'Fofana', pos: 'CDM', ovr: 82, age: 26, country: 'FRA' },
  { clubId: 'ita_ac_milan', firstName: 'Adrien', lastName: 'Rabiot', pos: 'CM', ovr: 84, age: 30, country: 'FRA' },
  { clubId: 'ita_ac_milan', firstName: 'Rafael', lastName: 'Leao', pos: 'LW', ovr: 86, age: 26, country: 'POR' },
  { clubId: 'ita_ac_milan', firstName: 'Christian', lastName: 'Pulisic', pos: 'RW', ovr: 84, age: 27, country: 'USA' },

  // Juventus
  { clubId: 'ita_juventus_fc', firstName: 'Michele', lastName: 'Di Gregorio', pos: 'GK', ovr: 81, age: 28, country: 'ITA' },
  { clubId: 'ita_juventus_fc', firstName: 'Gleison', lastName: 'Bremer', pos: 'CB', ovr: 85, age: 28, country: 'BRA' },
  { clubId: 'ita_juventus_fc', firstName: 'Pierre', lastName: 'Kalulu', pos: 'CB', ovr: 80, age: 25, country: 'FRA' },
  { clubId: 'ita_juventus_fc', firstName: 'Andrea', lastName: 'Cambiaso', pos: 'RWB', ovr: 81, age: 25, country: 'ITA' },
  { clubId: 'ita_juventus_fc', firstName: 'Manuel', lastName: 'Locatelli', pos: 'CDM', ovr: 81, age: 27, country: 'ITA' },
  { clubId: 'ita_juventus_fc', firstName: 'Kenan', lastName: 'Yildiz', pos: 'CAM', ovr: 83, age: 20, country: 'TUR', potential: 90 },
  { clubId: 'ita_juventus_fc', firstName: 'Dusan', lastName: 'Vlahovic', pos: 'ST', ovr: 82, age: 25, country: 'SRB' },
  { clubId: 'ita_juventus_fc', firstName: 'Jonathan', lastName: 'David', pos: 'ST', ovr: 82, age: 25, country: 'CAN' },

  // Napoli
  { clubId: 'ita_ssc_napoli', firstName: 'Alex', lastName: 'Meret', pos: 'GK', ovr: 80, age: 28, country: 'ITA' },
  { clubId: 'ita_ssc_napoli', firstName: 'Amir', lastName: 'Rrahmani', pos: 'CB', ovr: 82, age: 31, country: 'KVX' },
  { clubId: 'ita_ssc_napoli', firstName: 'Alessandro', lastName: 'Buongiorno', pos: 'CB', ovr: 82, age: 26, country: 'ITA' },
  { clubId: 'ita_ssc_napoli', firstName: 'Stanislav', lastName: 'Lobotka', pos: 'CDM', ovr: 84, age: 31, country: 'SVK' },
  { clubId: 'ita_ssc_napoli', firstName: 'Scott', lastName: 'McTominay', pos: 'CM', ovr: 84, age: 29, country: 'SCO' },
  { clubId: 'ita_ssc_napoli', firstName: 'Kevin', lastName: 'De Bruyne', pos: 'CAM', ovr: 86, age: 34, country: 'BEL' },
  { clubId: 'ita_ssc_napoli', firstName: 'Romelu', lastName: 'Lukaku', pos: 'ST', ovr: 82, age: 32, country: 'BEL' },
  { clubId: 'ita_ssc_napoli', firstName: 'Rasmus', lastName: 'Hojlund', pos: 'ST', ovr: 80, age: 23, country: 'DEN' },

  // Roma
  { clubId: 'ita_as_roma', firstName: 'Mile', lastName: 'Svilar', pos: 'GK', ovr: 84, age: 26, country: 'SRB' },
  { clubId: 'ita_as_roma', firstName: 'Evan', lastName: 'Ndicka', pos: 'CB', ovr: 81, age: 26, country: 'CIV' },
  { clubId: 'ita_as_roma', firstName: 'Gianluca', lastName: 'Mancini', pos: 'CB', ovr: 80, age: 29, country: 'ITA' },
  { clubId: 'ita_as_roma', firstName: 'Manu', lastName: 'Kone', pos: 'CM', ovr: 82, age: 24, country: 'FRA' },
  { clubId: 'ita_as_roma', firstName: 'Bryan', lastName: 'Cristante', pos: 'CDM', ovr: 78, age: 31, country: 'ITA' },
  { clubId: 'ita_as_roma', firstName: 'Paulo', lastName: 'Dybala', pos: 'CAM', ovr: 84, age: 32, country: 'ARG' },
  { clubId: 'ita_as_roma', firstName: 'Matias', lastName: 'Soule', pos: 'RW', ovr: 79, age: 22, country: 'ARG' },

  // PSG
  { clubId: 'fra_paris_saint_germain_fc', firstName: 'Lucas', lastName: 'Chevalier', pos: 'GK', ovr: 82, age: 24, country: 'FRA' },
  { clubId: 'fra_paris_saint_germain_fc', firstName: 'Marquinhos', lastName: 'Correa', pos: 'CB', ovr: 84, age: 31, country: 'BRA' },
  { clubId: 'fra_paris_saint_germain_fc', firstName: 'Willian', lastName: 'Pacho', pos: 'CB', ovr: 84, age: 24, country: 'ECU' },
  { clubId: 'fra_paris_saint_germain_fc', firstName: 'Achraf', lastName: 'Hakimi', pos: 'RB', ovr: 87, age: 27, country: 'MAR' },
  { clubId: 'fra_paris_saint_germain_fc', firstName: 'Nuno', lastName: 'Mendes', pos: 'LB', ovr: 86, age: 23, country: 'POR' },
  { clubId: 'fra_paris_saint_germain_fc', firstName: 'Vitinha', lastName: 'Ferreira', pos: 'CM', ovr: 88, age: 25, country: 'POR' },
  { clubId: 'fra_paris_saint_germain_fc', firstName: 'Ousmane', lastName: 'Dembele', pos: 'RW', ovr: 88, age: 28, country: 'FRA' },
  { clubId: 'fra_paris_saint_germain_fc', firstName: 'Khvicha', lastName: 'Kvaratskhelia', pos: 'LW', ovr: 87, age: 24, country: 'GEO' },
  { clubId: 'fra_paris_saint_germain_fc', firstName: 'Desire', lastName: 'Doue', pos: 'RW', ovr: 84, age: 20, country: 'FRA', potential: 91 },

  // Marseille
  { clubId: 'fra_olympique_de_marseille', firstName: 'Geronimo', lastName: 'Rulli', pos: 'GK', ovr: 80, age: 33, country: 'ARG' },
  { clubId: 'fra_olympique_de_marseille', firstName: 'Leonardo', lastName: 'Balerdi', pos: 'CB', ovr: 79, age: 27, country: 'ARG' },
  { clubId: 'fra_olympique_de_marseille', firstName: 'Facundo', lastName: 'Medina', pos: 'CB', ovr: 78, age: 26, country: 'ARG' },
  { clubId: 'fra_olympique_de_marseille', firstName: 'Pierre-Emile', lastName: 'Hojbjerg', pos: 'CM', ovr: 81, age: 30, country: 'DEN' },
  { clubId: 'fra_olympique_de_marseille', firstName: 'Mason', lastName: 'Greenwood', pos: 'RW', ovr: 84, age: 24, country: 'ENG' },
  { clubId: 'fra_olympique_de_marseille', firstName: 'Amine', lastName: 'Gouiri', pos: 'ST', ovr: 80, age: 25, country: 'ALG' },

  // Porto
  { clubId: 'por_fc_porto', firstName: 'Diogo', lastName: 'Costa', pos: 'GK', ovr: 85, age: 26, country: 'POR' },
  { clubId: 'por_fc_porto', firstName: 'Nehuen', lastName: 'Perez', pos: 'CB', ovr: 78, age: 25, country: 'ARG' },
  { clubId: 'por_fc_porto', firstName: 'Jan', lastName: 'Bednarek', pos: 'CB', ovr: 78, age: 29, country: 'POL' },
  { clubId: 'por_fc_porto', firstName: 'Stephen', lastName: 'Eustaquio', pos: 'CM', ovr: 78, age: 29, country: 'CAN' },
  { clubId: 'por_fc_porto', firstName: 'Rodrigo', lastName: 'Mora', pos: 'CAM', ovr: 79, age: 18, country: 'POR', potential: 89 },
  { clubId: 'por_fc_porto', firstName: 'Pepe', lastName: 'Aquino', pos: 'RW', ovr: 81, age: 28, country: 'BRA' },
  { clubId: 'por_fc_porto', firstName: 'Samu', lastName: 'Aghehowa', pos: 'ST', ovr: 82, age: 21, country: 'ESP', potential: 89 },

  // Benfica
  { clubId: 'por_sport_lisboa_e_benfica', firstName: 'Anatoliy', lastName: 'Trubin', pos: 'GK', ovr: 82, age: 24, country: 'UKR' },
  { clubId: 'por_sport_lisboa_e_benfica', firstName: 'Nicolas', lastName: 'Otamendi', pos: 'CB', ovr: 79, age: 37, country: 'ARG' },
  { clubId: 'por_sport_lisboa_e_benfica', firstName: 'Samuel', lastName: 'Dahl', pos: 'LB', ovr: 76, age: 22, country: 'SWE' },
  { clubId: 'por_sport_lisboa_e_benfica', firstName: 'Enzo', lastName: 'Barrenechea', pos: 'CM', ovr: 78, age: 24, country: 'ARG' },
  { clubId: 'por_sport_lisboa_e_benfica', firstName: 'Fredrik', lastName: 'Aursnes', pos: 'CM', ovr: 80, age: 30, country: 'NOR' },
  { clubId: 'por_sport_lisboa_e_benfica', firstName: 'Angel', lastName: 'Di Maria', pos: 'RW', ovr: 78, age: 37, country: 'ARG' },
  { clubId: 'por_sport_lisboa_e_benfica', firstName: 'Vangelis', lastName: 'Pavlidis', pos: 'ST', ovr: 81, age: 27, country: 'GRE' },

  // Sporting
  { clubId: 'por_sporting_clube_de_portugal', firstName: 'Rui', lastName: 'Silva', pos: 'GK', ovr: 79, age: 31, country: 'POR' },
  { clubId: 'por_sporting_clube_de_portugal', firstName: 'Goncalo', lastName: 'Inacio', pos: 'CB', ovr: 82, age: 24, country: 'POR' },
  { clubId: 'por_sporting_clube_de_portugal', firstName: 'Ousmane', lastName: 'Diomande', pos: 'CB', ovr: 80, age: 22, country: 'CIV' },
  { clubId: 'por_sporting_clube_de_portugal', firstName: 'Morten', lastName: 'Hjulmand', pos: 'CDM', ovr: 82, age: 26, country: 'DEN' },
  { clubId: 'por_sporting_clube_de_portugal', firstName: 'Francisco', lastName: 'Trincao', pos: 'RW', ovr: 82, age: 26, country: 'POR' },
  { clubId: 'por_sporting_clube_de_portugal', firstName: 'Geovany', lastName: 'Quenda', pos: 'RW', ovr: 78, age: 18, country: 'POR', potential: 88 },
  { clubId: 'por_sporting_clube_de_portugal', firstName: 'Luis', lastName: 'Suarez', pos: 'ST', ovr: 81, age: 23, country: 'COL' },

  // Ajax
  { clubId: 'ned_afc_ajax', firstName: 'Remko', lastName: 'Pasveer', pos: 'GK', ovr: 74, age: 42, country: 'NED' },
  { clubId: 'ned_afc_ajax', firstName: 'Youri', lastName: 'Baas', pos: 'CB', ovr: 76, age: 22, country: 'NED' },
  { clubId: 'ned_afc_ajax', firstName: 'Josip', lastName: 'Sutalo', pos: 'CB', ovr: 75, age: 26, country: 'CRO' },
  { clubId: 'ned_afc_ajax', firstName: 'Kenneth', lastName: 'Taylor', pos: 'CM', ovr: 78, age: 23, country: 'NED' },
  { clubId: 'ned_afc_ajax', firstName: 'Davy', lastName: 'Klaassen', pos: 'CM', ovr: 76, age: 32, country: 'NED' },
  { clubId: 'ned_afc_ajax', firstName: 'Mika', lastName: 'Godts', pos: 'LW', ovr: 77, age: 20, country: 'BEL', potential: 85 },
  { clubId: 'ned_afc_ajax', firstName: 'Wout', lastName: 'Weghorst', pos: 'ST', ovr: 76, age: 33, country: 'NED' },

  // PSV
  { clubId: 'ned_psv', firstName: 'Walter', lastName: 'Benitez', pos: 'GK', ovr: 79, age: 32, country: 'ARG' },
  { clubId: 'ned_psv', firstName: 'Ryan', lastName: 'Flamingo', pos: 'CB', ovr: 77, age: 23, country: 'NED' },
  { clubId: 'ned_psv', firstName: 'Sergino', lastName: 'Dest', pos: 'RB', ovr: 78, age: 25, country: 'USA' },
  { clubId: 'ned_psv', firstName: 'Joey', lastName: 'Veerman', pos: 'CM', ovr: 80, age: 27, country: 'NED' },
  { clubId: 'ned_psv', firstName: 'Ismael', lastName: 'Saibari', pos: 'CAM', ovr: 80, age: 24, country: 'MAR' },
  { clubId: 'ned_psv', firstName: 'Ivan', lastName: 'Perisic', pos: 'LW', ovr: 79, age: 36, country: 'CRO' },
  { clubId: 'ned_psv', firstName: 'Ricardo', lastName: 'Pepi', pos: 'ST', ovr: 78, age: 22, country: 'USA' },

  // Galatasaray
  { clubId: 'tur_galatasaray', firstName: 'Ugurcan', lastName: 'Cakir', pos: 'GK', ovr: 81, age: 29, country: 'TUR' },
  { clubId: 'tur_galatasaray', firstName: 'Davinson', lastName: 'Sanchez', pos: 'CB', ovr: 80, age: 29, country: 'COL' },
  { clubId: 'tur_galatasaray', firstName: 'Abdulkerim', lastName: 'Bardakci', pos: 'CB', ovr: 78, age: 31, country: 'TUR' },
  { clubId: 'tur_galatasaray', firstName: 'Lucas', lastName: 'Torreira', pos: 'CDM', ovr: 81, age: 29, country: 'URU' },
  { clubId: 'tur_galatasaray', firstName: 'Leroy', lastName: 'Sane', pos: 'RW', ovr: 83, age: 30, country: 'GER' },
  { clubId: 'tur_galatasaray', firstName: 'Yunus', lastName: 'Akgun', pos: 'LW', ovr: 77, age: 25, country: 'TUR' },
  { clubId: 'tur_galatasaray', firstName: 'Victor', lastName: 'Osimhen', pos: 'ST', ovr: 87, age: 27, country: 'NGA' },

  // Celtic
  { clubId: 'sco_celtic_fc', firstName: 'Kasper', lastName: 'Schmeichel', pos: 'GK', ovr: 76, age: 39, country: 'DEN' },
  { clubId: 'sco_celtic_fc', firstName: 'Cameron', lastName: 'Carter-Vickers', pos: 'CB', ovr: 77, age: 28, country: 'USA' },
  { clubId: 'sco_celtic_fc', firstName: 'Callum', lastName: 'McGregor', pos: 'CM', ovr: 77, age: 32, country: 'SCO' },
  { clubId: 'sco_celtic_fc', firstName: 'Reo', lastName: 'Hatate', pos: 'CM', ovr: 76, age: 28, country: 'JPN' },
  { clubId: 'sco_celtic_fc', firstName: 'Daizen', lastName: 'Maeda', pos: 'LW', ovr: 78, age: 28, country: 'JPN' },
];
