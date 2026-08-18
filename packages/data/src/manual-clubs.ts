/**
 * Club lists that upstream openfootball does not cover.
 *
 * These are authored by hand and marked `source: 'manual'` in the pack. They are
 * accurate enough to play with but are not guaranteed to match the exact
 * composition of the real 2025/26 division, and third tiers that are split into
 * regional groups are modelled here as a single group.
 */

export interface ManualClub {
  name: string;
  short: string;
  city?: string;
  /** 0-100 on-pitch strength; the build step maps this onto the tier band. */
  strength: number;
}

export const MANUAL_CLUBS: Record<string, ManualClub[]> = {
  'il.1': [
    { name: 'Maccabi Tel Aviv', short: 'Maccabi TA', city: 'Tel Aviv', strength: 72 },
    { name: 'Hapoel Beer Sheva', short: 'H. Beer Sheva', city: 'Beer Sheva', strength: 70 },
    { name: 'Maccabi Haifa', short: 'Maccabi Haifa', city: 'Haifa', strength: 69 },
    { name: 'Beitar Jerusalem', short: 'Beitar', city: 'Jerusalem', strength: 63 },
    { name: 'Hapoel Tel Aviv', short: 'Hapoel TA', city: 'Tel Aviv', strength: 60 },
    { name: 'Maccabi Netanya', short: 'M. Netanya', city: 'Netanya', strength: 57 },
    { name: 'Bnei Sakhnin', short: 'Sakhnin', city: 'Sakhnin', strength: 53 },
    { name: 'Ironi Kiryat Shmona', short: 'K. Shmona', city: 'Kiryat Shmona', strength: 52 },
    { name: 'Hapoel Haifa', short: 'H. Haifa', city: 'Haifa', strength: 55 },
    { name: 'Maccabi Bnei Raina', short: 'Bnei Raina', city: 'Reineh', strength: 48 },
    { name: 'Ironi Tiberias', short: 'Tiberias', city: 'Tiberias', strength: 47 },
    { name: 'Hapoel Petah Tikva', short: 'H. Petah Tikva', city: 'Petah Tikva', strength: 49 },
    { name: 'FC Ashdod', short: 'Ashdod', city: 'Ashdod', strength: 50 },
    { name: 'Hapoel Hadera', short: 'Hadera', city: 'Hadera', strength: 46 },
  ],
  'il.2': [
    { name: 'Hapoel Jerusalem', short: 'H. Jerusalem', city: 'Jerusalem', strength: 44 },
    { name: 'Maccabi Petah Tikva', short: 'M. Petah Tikva', city: 'Petah Tikva', strength: 43 },
    { name: 'Hapoel Ramat Gan', short: 'Ramat Gan', city: 'Ramat Gan', strength: 40 },
    { name: 'Hapoel Nof HaGalil', short: 'Nof HaGalil', city: 'Nof HaGalil', strength: 39 },
    { name: 'Hapoel Raanana', short: 'Raanana', city: "Ra'anana", strength: 38 },
    { name: 'Hapoel Rishon LeZion', short: 'Rishon', city: 'Rishon LeZion', strength: 38 },
    { name: 'Hapoel Kfar Saba', short: 'Kfar Saba', city: 'Kfar Saba', strength: 37 },
    { name: 'Hapoel Afula', short: 'Afula', city: 'Afula', strength: 36 },
    { name: 'Hapoel Umm al-Fahm', short: 'Umm al-Fahm', city: 'Umm al-Fahm', strength: 36 },
    { name: 'Maccabi Herzliya', short: 'Herzliya', city: 'Herzliya', strength: 35 },
    { name: 'Hapoel Ashkelon', short: 'Ashkelon', city: 'Ashkelon', strength: 35 },
    { name: 'Sektzia Nes Ziona', short: 'Nes Ziona', city: 'Nes Ziona', strength: 34 },
    { name: 'Hapoel Acre', short: 'Acre', city: 'Acre', strength: 34 },
    { name: 'Maccabi Kabilio Jaffa', short: 'Jaffa', city: 'Tel Aviv', strength: 33 },
    { name: 'Hapoel Kfar Shalem', short: 'Kfar Shalem', city: 'Tel Aviv', strength: 32 },
    { name: 'Ironi Nesher', short: 'Nesher', city: 'Nesher', strength: 32 },
  ],
  'il.3': [
    { name: 'Beitar Tel Aviv Bat Yam', short: 'Beitar TA', city: 'Bat Yam', strength: 30 },
    { name: 'Hapoel Marmorek', short: 'Marmorek', city: 'Rehovot', strength: 29 },
    { name: 'Maccabi Sha’arayim', short: "Sha'arayim", city: 'Ramla', strength: 29 },
    { name: 'Hapoel Azor', short: 'Azor', city: 'Azor', strength: 28 },
    { name: 'Beitar Kfar Saba', short: 'Beitar KS', city: 'Kfar Saba', strength: 28 },
    { name: 'Hapoel Herzliya', short: 'H. Herzliya', city: 'Herzliya', strength: 28 },
    { name: 'Maccabi Ironi Amishav', short: 'Amishav', city: 'Petah Tikva', strength: 27 },
    { name: 'Hapoel Bnei Zalafa', short: 'Zalafa', city: 'Zalafa', strength: 27 },
    { name: 'Maccabi Ironi Bat Yam', short: 'M. Bat Yam', city: 'Bat Yam', strength: 26 },
    { name: 'Hapoel Ironi Arad', short: 'Arad', city: 'Arad', strength: 26 },
    { name: 'Maccabi Kiryat Gat', short: 'Kiryat Gat', city: 'Kiryat Gat', strength: 26 },
    { name: 'Ihud Bnei Shefa-Amr', short: 'Shefa-Amr', city: 'Shefa-Amr', strength: 25 },
    { name: 'Maccabi Ahi Nazareth', short: 'Ahi Nazareth', city: 'Nazareth', strength: 25 },
    { name: 'Hapoel Beit Shean', short: 'Beit Shean', city: "Beit She'an", strength: 24 },
    { name: 'Hapoel Migdal HaEmek', short: 'Migdal HaEmek', city: 'Migdal HaEmek', strength: 24 },
    { name: 'Hapoel Bikat HaYarden', short: 'Bikat HaYarden', city: 'Jordan Valley', strength: 23 },
  ],
  'es.3': [
    { name: 'Real Madrid Castilla', short: 'Castilla', city: 'Madrid', strength: 46 },
    { name: 'Barcelona Atletic', short: 'Barca Atletic', city: 'Barcelona', strength: 45 },
    { name: 'SD Ponferradina', short: 'Ponferradina', city: 'Ponferrada', strength: 44 },
    { name: 'Racing Club Ferrol', short: 'Ferrol', city: 'Ferrol', strength: 43 },
    { name: 'Gimnastic de Tarragona', short: 'Nastic', city: 'Tarragona', strength: 42 },
    { name: 'Unionistas de Salamanca', short: 'Unionistas', city: 'Salamanca', strength: 41 },
    { name: 'Osasuna Promesas', short: 'Osasuna B', city: 'Pamplona', strength: 40 },
    { name: 'Bilbao Athletic', short: 'Bilbao Ath.', city: 'Bilbao', strength: 41 },
    { name: 'Sestao River Club', short: 'Sestao', city: 'Sestao', strength: 39 },
    { name: 'CD Arenteiro', short: 'Arenteiro', city: 'O Carballino', strength: 38 },
    { name: 'Ourense CF', short: 'Ourense', city: 'Ourense', strength: 38 },
    { name: 'Zamora CF', short: 'Zamora', city: 'Zamora', strength: 37 },
    { name: 'Real Aviles', short: 'Aviles', city: 'Aviles', strength: 37 },
    { name: 'CD Guadalajara', short: 'Guadalajara', city: 'Guadalajara', strength: 36 },
    { name: 'CF Talavera de la Reina', short: 'Talavera', city: 'Talavera', strength: 36 },
    { name: 'Merida AD', short: 'Merida', city: 'Merida', strength: 37 },
    { name: 'Atletico Madrileno', short: 'Atleti B', city: 'Madrid', strength: 40 },
    { name: 'Betis Deportivo', short: 'Betis B', city: 'Seville', strength: 39 },
    { name: 'AD Alcorcon', short: 'Alcorcon', city: 'Alcorcon', strength: 42 },
    { name: 'Algeciras CF', short: 'Algeciras', city: 'Algeciras', strength: 36 },
  ],
  'it.3': [
    { name: 'Ternana Calcio', short: 'Ternana', city: 'Terni', strength: 45 },
    { name: 'LR Vicenza', short: 'Vicenza', city: 'Vicenza', strength: 47 },
    { name: 'Benevento Calcio', short: 'Benevento', city: 'Benevento', strength: 46 },
    { name: 'FC Crotone', short: 'Crotone', city: 'Crotone', strength: 44 },
    { name: 'Catania FC', short: 'Catania', city: 'Catania', strength: 44 },
    { name: 'Foggia Calcio', short: 'Foggia', city: 'Foggia', strength: 40 },
    { name: 'Casertana FC', short: 'Casertana', city: 'Caserta', strength: 39 },
    { name: 'Trapani Calcio', short: 'Trapani', city: 'Trapani', strength: 40 },
    { name: 'Juventus Next Gen', short: 'Juve NG', city: 'Turin', strength: 42 },
    { name: 'Atalanta U23', short: 'Atalanta U23', city: 'Bergamo', strength: 42 },
    { name: 'AC Perugia', short: 'Perugia', city: 'Perugia', strength: 41 },
    { name: 'Rimini FC', short: 'Rimini', city: 'Rimini', strength: 38 },
    { name: 'Pineto Calcio', short: 'Pineto', city: 'Pineto', strength: 36 },
    { name: 'AS Gubbio', short: 'Gubbio', city: 'Gubbio', strength: 37 },
    { name: 'US Pontedera', short: 'Pontedera', city: 'Pontedera', strength: 37 },
    { name: 'SS Arezzo', short: 'Arezzo', city: 'Arezzo', strength: 41 },
    { name: 'Giana Erminio', short: 'Giana', city: 'Gorgonzola', strength: 35 },
    { name: 'AlbinoLeffe', short: 'AlbinoLeffe', city: 'Bergamo', strength: 36 },
    { name: 'Renate FC', short: 'Renate', city: 'Renate', strength: 36 },
    { name: 'US Alessandria', short: 'Alessandria', city: 'Alessandria', strength: 35 },
  ],
};
