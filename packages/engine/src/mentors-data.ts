/**
 * The old players.
 *
 * Every football country has its handful of names that everybody's father brings up: the
 * one who won the thing, the one who could do anything with a ball, the one who never
 * left. A young player who gets one of them to take an interest in him has something no
 * amount of training gives him - somebody who has already been where he is going.
 *
 * Six or seven per country, all of them retired, all of them real. `tag` is what they are
 * remembered for and `voice` is how they talk, which is what shapes the advice they give.
 */

export type MentorVoice =
  /** Won things and expects you to. Pushes you up, hard, and has no patience for comfort. */
  | 'winner'
  /** Played for the joy of it. Tells you to express yourself and take the risky pass. */
  | 'artist'
  /** Got there on work. Believes minutes and repetitions beat talent, because his did. */
  | 'grinder'
  /** Led dressing rooms. Talks about the people around you before he talks about you. */
  | 'captain'
  /** Left young and never regretted it. Thinks a career is built abroad. */
  | 'wanderer'
  /** Stopped people for a living. Body, position, concentration, the boring things. */
  | 'wall';

export type MentorTag =
  | 'ballonDor'
  | 'worldCup'
  | 'europeanCup'
  | 'goalMachine'
  | 'oneClubMan'
  | 'captain'
  | 'playmaker'
  | 'keeper'
  | 'pioneer';

export interface MentorDef {
  id: string;
  country: string;
  name: string;
  /** How he is known in Hebrew. Transliteration is not good enough for names like these. */
  nameHe: string;
  /** The position he is remembered in. */
  position: 'GK' | 'DF' | 'MF' | 'FW';
  /** Roughly when he played, shown as "1984-2001". */
  era: string;
  /** The club he is spoken about with. */
  club: string;
  tag: MentorTag;
  voice: MentorVoice;
}

const m = (
  id: string,
  country: string,
  name: string,
  nameHe: string,
  position: MentorDef['position'],
  era: string,
  club: string,
  tag: MentorTag,
  voice: MentorVoice,
): MentorDef => ({ id, country, name, nameHe, position, era, club, tag, voice });

export const MENTORS: MentorDef[] = [
  // ---------------------------------------------------------------- England
  m('eng_charlton', 'ENG', 'Bobby Charlton', 'בובי צ׳רלטון', 'MF', '1956-1975', 'Manchester United', 'worldCup', 'captain'),
  m('eng_moore', 'ENG', 'Bobby Moore', 'בובי מור', 'DF', '1958-1978', 'West Ham United', 'worldCup', 'wall'),
  m('eng_shearer', 'ENG', 'Alan Shearer', 'אלן שירר', 'FW', '1988-2006', 'Newcastle United', 'goalMachine', 'grinder'),
  m('eng_gerrard', 'ENG', 'Steven Gerrard', 'סטיבן ג׳רארד', 'MF', '1998-2016', 'Liverpool', 'captain', 'captain'),
  m('eng_scholes', 'ENG', 'Paul Scholes', 'פול סקולס', 'MF', '1993-2013', 'Manchester United', 'oneClubMan', 'artist'),
  m('eng_beckham', 'ENG', 'David Beckham', 'דיוויד בקהאם', 'MF', '1992-2013', 'Manchester United', 'pioneer', 'wanderer'),
  m('eng_shilton', 'ENG', 'Peter Shilton', 'פיטר שילטון', 'GK', '1966-1997', 'Nottingham Forest', 'keeper', 'grinder'),

  // ---------------------------------------------------------------- Spain
  m('esp_raul', 'ESP', 'Raúl González', 'ראול גונסאלס', 'FW', '1994-2015', 'Real Madrid', 'goalMachine', 'winner'),
  m('esp_xavi', 'ESP', 'Xavi Hernández', 'צ׳אבי ארננדס', 'MF', '1998-2019', 'Barcelona', 'playmaker', 'artist'),
  m('esp_iniesta', 'ESP', 'Andrés Iniesta', 'אנדרס איניאסטה', 'MF', '2002-2024', 'Barcelona', 'worldCup', 'artist'),
  m('esp_casillas', 'ESP', 'Iker Casillas', 'איקר קסייאס', 'GK', '1999-2020', 'Real Madrid', 'keeper', 'captain'),
  m('esp_puyol', 'ESP', 'Carles Puyol', 'קרלס פויול', 'DF', '1999-2014', 'Barcelona', 'oneClubMan', 'wall'),
  m('esp_hierro', 'ESP', 'Fernando Hierro', 'פרננדו ייארו', 'DF', '1987-2005', 'Real Madrid', 'captain', 'captain'),
  m('esp_butragueno', 'ESP', 'Emilio Butragueño', 'אמיליו בוטרגניו', 'FW', '1983-1998', 'Real Madrid', 'goalMachine', 'artist'),

  // ---------------------------------------------------------------- Italy
  m('ita_maldini', 'ITA', 'Paolo Maldini', 'פאולו מלדיני', 'DF', '1985-2009', 'Milan', 'oneClubMan', 'wall'),
  m('ita_baggio', 'ITA', 'Roberto Baggio', 'רוברטו באג׳ו', 'FW', '1982-2004', 'Juventus', 'ballonDor', 'artist'),
  m('ita_baresi', 'ITA', 'Franco Baresi', 'פרנקו ברזי', 'DF', '1977-1997', 'Milan', 'captain', 'wall'),
  m('ita_buffon', 'ITA', 'Gianluigi Buffon', 'ג׳אנלואיג׳י בופון', 'GK', '1995-2023', 'Juventus', 'keeper', 'grinder'),
  m('ita_delpiero', 'ITA', 'Alessandro Del Piero', 'אלסנדרו דל פיירו', 'FW', '1991-2014', 'Juventus', 'oneClubMan', 'winner'),
  m('ita_totti', 'ITA', 'Francesco Totti', 'פרנצ׳סקו טוטי', 'FW', '1992-2017', 'Roma', 'oneClubMan', 'artist'),
  m('ita_zoff', 'ITA', 'Dino Zoff', 'דינו זוף', 'GK', '1961-1983', 'Juventus', 'worldCup', 'wall'),

  // ---------------------------------------------------------------- Germany
  m('ger_beckenbauer', 'GER', 'Franz Beckenbauer', 'פרנץ בקנבאואר', 'DF', '1964-1983', 'Bayern München', 'ballonDor', 'captain'),
  m('ger_muller', 'GER', 'Gerd Müller', 'גרד מולר', 'FW', '1964-1981', 'Bayern München', 'goalMachine', 'grinder'),
  m('ger_matthaus', 'GER', 'Lothar Matthäus', 'לותר מתאוס', 'MF', '1979-2000', 'Bayern München', 'worldCup', 'winner'),
  m('ger_kahn', 'GER', 'Oliver Kahn', 'אוליבר קאן', 'GK', '1987-2008', 'Bayern München', 'keeper', 'winner'),
  m('ger_klinsmann', 'GER', 'Jürgen Klinsmann', 'יורגן קלינסמן', 'FW', '1981-1998', 'Internazionale Milano', 'worldCup', 'wanderer'),
  m('ger_lahm', 'GER', 'Philipp Lahm', 'פיליפ לאם', 'DF', '2002-2017', 'Bayern München', 'captain', 'captain'),
  m('ger_rummenigge', 'GER', 'Karl-Heinz Rummenigge', 'קרל-היינץ רומניגה', 'FW', '1974-1989', 'Bayern München', 'ballonDor', 'winner'),

  // ---------------------------------------------------------------- France
  m('fra_zidane', 'FRA', 'Zinédine Zidane', 'זינדין זידאן', 'MF', '1989-2006', 'Real Madrid', 'ballonDor', 'artist'),
  m('fra_platini', 'FRA', 'Michel Platini', 'מישל פלאטיני', 'MF', '1972-1987', 'Juventus', 'ballonDor', 'artist'),
  m('fra_henry', 'FRA', 'Thierry Henry', 'תיירי אנרי', 'FW', '1994-2014', 'Arsenal', 'goalMachine', 'wanderer'),
  m('fra_desailly', 'FRA', 'Marcel Desailly', 'מרסל דסאיי', 'DF', '1986-2006', 'Milan', 'worldCup', 'wall'),
  m('fra_vieira', 'FRA', 'Patrick Vieira', 'פטריק וייטה', 'MF', '1994-2011', 'Arsenal', 'captain', 'captain'),
  m('fra_deschamps', 'FRA', 'Didier Deschamps', 'דידייה דשאן', 'MF', '1985-2001', 'Juventus', 'captain', 'winner'),
  m('fra_thuram', 'FRA', 'Lilian Thuram', 'ליליאן תוראם', 'DF', '1991-2008', 'Juventus', 'worldCup', 'wall'),

  // ---------------------------------------------------------------- Portugal
  m('por_eusebio', 'POR', 'Eusébio', 'אוזביו', 'FW', '1957-1979', 'Benfica', 'ballonDor', 'grinder'),
  m('por_figo', 'POR', 'Luís Figo', 'לואיש פיגו', 'MF', '1989-2009', 'Real Madrid', 'ballonDor', 'wanderer'),
  m('por_ruicosta', 'POR', 'Rui Costa', 'רוי קושטה', 'MF', '1990-2008', 'Milan', 'playmaker', 'artist'),
  m('por_futre', 'POR', 'Paulo Futre', 'פאולו פוטרה', 'FW', '1983-1998', 'Atlético Madrid', 'europeanCup', 'artist'),
  m('por_baia', 'POR', 'Vítor Baía', 'ויטור באיה', 'GK', '1988-2007', 'Porto', 'keeper', 'winner'),
  m('por_deco', 'POR', 'Deco', 'דקו', 'MF', '1997-2013', 'Porto', 'europeanCup', 'wanderer'),
  m('por_nunogomes', 'POR', 'Nuno Gomes', 'נונו גומש', 'FW', '1994-2013', 'Benfica', 'oneClubMan', 'grinder'),

  // ---------------------------------------------------------------- Netherlands
  m('ned_cruyff', 'NED', 'Johan Cruyff', 'יוהאן קרויף', 'FW', '1964-1984', 'Ajax', 'ballonDor', 'artist'),
  m('ned_vanbasten', 'NED', 'Marco van Basten', 'מרקו ואן באסטן', 'FW', '1981-1995', 'Milan', 'ballonDor', 'winner'),
  m('ned_gullit', 'NED', 'Ruud Gullit', 'רוד חוליט', 'MF', '1979-1998', 'Milan', 'ballonDor', 'wanderer'),
  m('ned_rijkaard', 'NED', 'Frank Rijkaard', 'פרנק רייקארד', 'MF', '1980-1995', 'Milan', 'europeanCup', 'captain'),
  m('ned_bergkamp', 'NED', 'Dennis Bergkamp', 'דניס ברגקאמפ', 'FW', '1986-2006', 'Arsenal', 'playmaker', 'artist'),
  m('ned_vandersar', 'NED', 'Edwin van der Sar', 'אדווין ואן דר סאר', 'GK', '1990-2011', 'Manchester United', 'keeper', 'grinder'),
  m('ned_seedorf', 'NED', 'Clarence Seedorf', 'קלרנס סידורף', 'MF', '1992-2014', 'Milan', 'europeanCup', 'wanderer'),

  // ---------------------------------------------------------------- Israel
  m('isr_spiegler', 'ISR', 'Mordechai Spiegler', 'מרדכי שפיגלר', 'FW', '1962-1980', 'Maccabi Netanya', 'pioneer', 'wanderer'),
  m('isr_ohana', 'ISR', 'Eli Ohana', 'אלי אוחנה', 'FW', '1980-1997', 'Beitar Jerusalem', 'goalMachine', 'artist'),
  m('isr_rosenthal', 'ISR', 'Ronny Rosenthal', 'רוני רוזנטל', 'FW', '1980-1999', 'Liverpool', 'pioneer', 'wanderer'),
  m('isr_avicohen', 'ISR', 'Avi Cohen', 'אבי כהן', 'DF', '1974-1996', 'Liverpool', 'pioneer', 'wall'),
  m('isr_benayoun', 'ISR', 'Yossi Benayoun', 'יוסי בניון', 'MF', '1994-2019', 'Liverpool', 'playmaker', 'grinder'),
  m('isr_revivo', 'ISR', 'Haim Revivo', 'חיים רביבו', 'MF', '1990-2005', 'Celta Vigo', 'playmaker', 'wanderer'),
  m('isr_nimni', 'ISR', 'Avi Nimni', 'אבי נמני', 'MF', '1990-2010', 'Maccabi Tel Aviv', 'oneClubMan', 'artist'),
  m('isr_banin', 'ISR', 'Tal Banin', 'טל בנין', 'MF', '1988-2004', 'Maccabi Tel Aviv', 'captain', 'captain'),

  // ---------------------------------------------------------------- Turkey
  m('tur_sukur', 'TUR', 'Hakan Şükür', 'האקאן שוקור', 'FW', '1987-2008', 'Galatasaray', 'goalMachine', 'winner'),
  m('tur_rustu', 'TUR', 'Rüştü Reçber', 'רושטו רצ׳בר', 'GK', '1990-2012', 'Fenerbahçe', 'keeper', 'grinder'),
  m('tur_tugay', 'TUR', 'Tugay Kerimoğlu', 'טוגאי קרימואולו', 'MF', '1988-2009', 'Blackburn Rovers', 'playmaker', 'wanderer'),
  m('tur_emre', 'TUR', 'Emre Belözoğlu', 'אמרה בלוזואולו', 'MF', '1996-2021', 'Fenerbahçe', 'playmaker', 'artist'),
  m('tur_oktay', 'TUR', 'Metin Oktay', 'מטין אוקטאי', 'FW', '1955-1969', 'Galatasaray', 'goalMachine', 'grinder'),
  m('tur_alpay', 'TUR', 'Alpay Özalan', 'אלפאי אוזאלאן', 'DF', '1992-2008', 'Fenerbahçe', 'captain', 'wall'),

  // ---------------------------------------------------------------- Belgium
  m('bel_vanhimst', 'BEL', 'Paul Van Himst', 'פול ואן הימסט', 'FW', '1959-1976', 'Anderlecht', 'goalMachine', 'artist'),
  m('bel_ceulemans', 'BEL', 'Jan Ceulemans', 'יאן קולמנס', 'MF', '1974-1992', 'Club Brugge', 'captain', 'captain'),
  m('bel_scifo', 'BEL', 'Enzo Scifo', 'אנצו שיפו', 'MF', '1982-2000', 'Anderlecht', 'playmaker', 'artist'),
  m('bel_gerets', 'BEL', 'Eric Gerets', 'אריק חרטס', 'DF', '1971-1992', 'PSV', 'captain', 'wall'),
  m('bel_pfaff', 'BEL', 'Jean-Marie Pfaff', 'ז׳אן-מארי פאף', 'GK', '1972-1991', 'Bayern München', 'keeper', 'grinder'),
  m('bel_kompany', 'BEL', 'Vincent Kompany', 'ונסן קומפאני', 'DF', '2003-2020', 'Manchester City', 'captain', 'captain'),

  // ---------------------------------------------------------------- Austria
  m('aut_sindelar', 'AUT', 'Matthias Sindelar', 'מתיאס זינדלר', 'FW', '1924-1939', 'Austria Wien', 'pioneer', 'artist'),
  m('aut_krankl', 'AUT', 'Hans Krankl', 'הנס קרנקל', 'FW', '1970-1989', 'Barcelona', 'goalMachine', 'wanderer'),
  m('aut_prohaska', 'AUT', 'Herbert Prohaska', 'הרברט פרוהסקה', 'MF', '1972-1989', 'Austria Wien', 'playmaker', 'artist'),
  m('aut_polster', 'AUT', 'Toni Polster', 'טוני פולסטר', 'FW', '1982-2000', 'Austria Wien', 'goalMachine', 'grinder'),
  m('aut_herzog', 'AUT', 'Andreas Herzog', 'אנדראס הרצוג', 'MF', '1986-2003', 'Werder Bremen', 'playmaker', 'wanderer'),
  m('aut_happel', 'AUT', 'Ernst Happel', 'ארנסט האפל', 'DF', '1942-1959', 'Rapid Wien', 'pioneer', 'wall'),

  // ---------------------------------------------------------------- Greece
  m('gre_zagorakis', 'GRE', 'Theodoros Zagorakis', 'תיאודורוס זגוראקיס', 'MF', '1988-2007', 'PAOK', 'captain', 'captain'),
  m('gre_karagounis', 'GRE', 'Giorgos Karagounis', 'יורגוס קרגוניס', 'MF', '1995-2014', 'Panathinaikos', 'playmaker', 'grinder'),
  m('gre_charisteas', 'GRE', 'Angelos Charisteas', 'אנגלוס חריסטאס', 'FW', '1997-2014', 'Werder Bremen', 'goalMachine', 'wanderer'),
  m('gre_domazos', 'GRE', 'Mimis Domazos', 'מימיס דומאזוס', 'MF', '1959-1980', 'Panathinaikos', 'oneClubMan', 'artist'),
  m('gre_nikopolidis', 'GRE', 'Antonis Nikopolidis', 'אנטוניס ניקופולידיס', 'GK', '1989-2011', 'Olympiakos', 'keeper', 'wall'),
  m('gre_dellas', 'GRE', 'Traianos Dellas', 'טראיאנוס דלאס', 'DF', '1994-2011', 'AS Roma', 'captain', 'wall'),

  // ---------------------------------------------------------------- Scotland
  m('sco_dalglish', 'SCO', 'Kenny Dalglish', 'קני דלגליש', 'FW', '1968-1990', 'Liverpool', 'europeanCup', 'winner'),
  m('sco_law', 'SCO', 'Denis Law', 'דניס לאו', 'FW', '1956-1974', 'Manchester United', 'ballonDor', 'grinder'),
  m('sco_baxter', 'SCO', 'Jim Baxter', 'ג׳ים בקסטר', 'MF', '1957-1970', 'Rangers', 'playmaker', 'artist'),
  m('sco_souness', 'SCO', 'Graeme Souness', 'גרהם סונס', 'MF', '1970-1991', 'Liverpool', 'captain', 'captain'),
  m('sco_bremner', 'SCO', 'Billy Bremner', 'בילי ברמנר', 'MF', '1959-1982', 'Leeds United', 'captain', 'grinder'),
  m('sco_mccoist', 'SCO', 'Ally McCoist', 'אלי מקוייסט', 'FW', '1978-2001', 'Rangers', 'goalMachine', 'grinder'),

  // ---------------------------------------------------------------- Switzerland
  m('sui_chapuisat', 'SUI', 'Stéphane Chapuisat', 'סטפן שאפויזה', 'FW', '1986-2007', 'Borussia Dortmund', 'europeanCup', 'wanderer'),
  m('sui_frei', 'SUI', 'Alexander Frei', 'אלכסנדר פריי', 'FW', '1997-2013', 'Basel', 'goalMachine', 'grinder'),
  m('sui_kuhn', 'SUI', 'Köbi Kuhn', 'קובי קון', 'MF', '1959-1977', 'Zürich', 'oneClubMan', 'captain'),
  m('sui_sforza', 'SUI', 'Ciriaco Sforza', 'צ׳יריאקו ספורצה', 'MF', '1988-2006', 'Bayern München', 'playmaker', 'wanderer'),
  m('sui_yakin', 'SUI', 'Hakan Yakin', 'האקאן יאקין', 'MF', '1994-2014', 'Young Boys', 'playmaker', 'artist'),
  m('sui_zuberbuhler', 'SUI', 'Pascal Zuberbühler', 'פסקל צוברביהלר', 'GK', '1990-2011', 'Basel', 'keeper', 'wall'),

  // ---------------------------------------------------------------- Ukraine
  m('ukr_shevchenko', 'UKR', 'Andriy Shevchenko', 'אנדריי שבצ׳נקו', 'FW', '1994-2012', 'Milan', 'ballonDor', 'winner'),
  m('ukr_blokhin', 'UKR', 'Oleg Blokhin', 'אולג בלוחין', 'FW', '1969-1990', 'Dynamo Kyiv', 'ballonDor', 'grinder'),
  m('ukr_belanov', 'UKR', 'Igor Belanov', 'איגור בלאנוב', 'FW', '1981-1995', 'Dynamo Kyiv', 'ballonDor', 'artist'),
  m('ukr_tymoshchuk', 'UKR', 'Anatoliy Tymoshchuk', 'אנטולי טימושצ׳וק', 'MF', '1997-2016', 'Shakhtar Donetsk', 'captain', 'grinder'),
  m('ukr_shovkovskyi', 'UKR', 'Oleksandr Shovkovskyi', 'אולכסנדר שובקובסקי', 'GK', '1992-2016', 'Dynamo Kyiv', 'keeper', 'wall'),
  m('ukr_rebrov', 'UKR', 'Serhiy Rebrov', 'סרחיי רברוב', 'FW', '1990-2009', 'Dynamo Kyiv', 'goalMachine', 'wanderer'),

  // ---------------------------------------------------------------- Czechia
  m('cze_nedved', 'CZE', 'Pavel Nedvěd', 'פאבל נדבד', 'MF', '1991-2009', 'Juventus', 'ballonDor', 'grinder'),
  m('cze_masopust', 'CZE', 'Josef Masopust', 'יוסף מסופוסט', 'MF', '1950-1970', 'Dukla Praha', 'ballonDor', 'artist'),
  m('cze_panenka', 'CZE', 'Antonín Panenka', 'אנטונין פננקה', 'MF', '1967-1993', 'Bohemians Praha', 'pioneer', 'artist'),
  m('cze_cech', 'CZE', 'Petr Čech', 'פטר צ׳ך', 'GK', '1999-2019', 'Chelsea', 'keeper', 'wall'),
  m('cze_rosicky', 'CZE', 'Tomáš Rosický', 'תומאש רוסיצקי', 'MF', '1998-2017', 'Arsenal', 'playmaker', 'artist'),
  m('cze_poborsky', 'CZE', 'Karel Poborský', 'קארל פובורסקי', 'MF', '1991-2007', 'Sparta Praha', 'europeanCup', 'wanderer'),

  // ---------------------------------------------------------------- Croatia
  m('cro_suker', 'CRO', 'Davor Šuker', 'דבור שוקר', 'FW', '1984-2003', 'Real Madrid', 'goalMachine', 'winner'),
  m('cro_boban', 'CRO', 'Zvonimir Boban', 'זבונימיר בובאן', 'MF', '1985-2002', 'Milan', 'captain', 'captain'),
  m('cro_prosinecki', 'CRO', 'Robert Prosinečki', 'רוברט פרוסינצקי', 'MF', '1986-2004', 'Real Madrid', 'playmaker', 'artist'),
  m('cro_bilic', 'CRO', 'Slaven Bilić', 'סלאבן ביליץ׳', 'DF', '1988-2001', 'West Ham United', 'captain', 'wall'),
  m('cro_simic', 'CRO', 'Dario Šimić', 'דאריו שימיץ׳', 'DF', '1992-2010', 'Milan', 'europeanCup', 'wall'),
  m('cro_jarni', 'CRO', 'Robert Jarni', 'רוברט יארני', 'DF', '1986-2003', 'Real Betis', 'worldCup', 'wanderer'),

  // ---------------------------------------------------------------- Serbia
  m('srb_dzajic', 'SRB', 'Dragan Džajić', 'דראגאן ג׳איץ׳', 'FW', '1963-1978', 'Crvena Zvezda', 'pioneer', 'artist'),
  m('srb_stojkovic', 'SRB', 'Dragan Stojković', 'דראגאן סטויקוביץ׳', 'MF', '1981-2001', 'Crvena Zvezda', 'playmaker', 'artist'),
  m('srb_mihajlovic', 'SRB', 'Siniša Mihajlović', 'סינישה מיהאילוביץ׳', 'DF', '1988-2006', 'Lazio', 'captain', 'wall'),
  m('srb_vidic', 'SRB', 'Nemanja Vidić', 'נמאניה וידיץ׳', 'DF', '2000-2016', 'Manchester United', 'captain', 'wall'),
  m('srb_milosevic', 'SRB', 'Savo Milošević', 'סאבו מילושביץ׳', 'FW', '1991-2010', 'Aston Villa', 'goalMachine', 'wanderer'),
  m('srb_ivanovic', 'SRB', 'Branislav Ivanović', 'בראניסלב איבנוביץ׳', 'DF', '2002-2021', 'Chelsea', 'europeanCup', 'grinder'),

  // ---------------------------------------------------------------- Denmark
  m('den_mlaudrup', 'DEN', 'Michael Laudrup', 'מיכאל לאודרופ', 'MF', '1981-1998', 'Barcelona', 'playmaker', 'artist'),
  m('den_blaudrup', 'DEN', 'Brian Laudrup', 'בריאן לאודרופ', 'FW', '1986-2000', 'Rangers', 'europeanCup', 'wanderer'),
  m('den_schmeichel', 'DEN', 'Peter Schmeichel', 'פיטר שמייכל', 'GK', '1981-2003', 'Manchester United', 'keeper', 'winner'),
  m('den_elkjaer', 'DEN', 'Preben Elkjær', 'פרבן אלקייר', 'FW', '1976-1990', 'Hellas Verona', 'goalMachine', 'grinder'),
  m('den_simonsen', 'DEN', 'Allan Simonsen', 'אלן סימונסן', 'FW', '1970-1989', 'Borussia Mönchengladbach', 'ballonDor', 'wanderer'),
  m('den_olsen', 'DEN', 'Morten Olsen', 'מורטן אולסן', 'DF', '1967-1989', 'Anderlecht', 'captain', 'captain'),

  // ---------------------------------------------------------------- Norway
  m('nor_solskjaer', 'NOR', 'Ole Gunnar Solskjær', 'אולה גונאר סולשאר', 'FW', '1994-2007', 'Manchester United', 'europeanCup', 'grinder'),
  m('nor_riise', 'NOR', 'John Arne Riise', 'ג׳ון ארנה ריסה', 'DF', '1998-2018', 'Liverpool', 'europeanCup', 'wanderer'),
  m('nor_flo', 'NOR', 'Tore André Flo', 'טורה אנדרה פלו', 'FW', '1993-2011', 'Chelsea', 'goalMachine', 'wanderer'),
  m('nor_bratseth', 'NOR', 'Rune Bratseth', 'רונה בראטסת', 'DF', '1982-1995', 'Werder Bremen', 'captain', 'wall'),
  m('nor_fjortoft', 'NOR', 'Jan Åge Fjørtoft', 'יאן אוגה פיורטופט', 'FW', '1985-2001', 'Rapid Wien', 'goalMachine', 'grinder'),
  m('nor_berg', 'NOR', 'Henning Berg', 'הנינג ברג', 'DF', '1986-2004', 'Blackburn Rovers', 'captain', 'wall'),

  // ---------------------------------------------------------------- Sweden
  m('swe_ibrahimovic', 'SWE', 'Zlatan Ibrahimović', 'זלאטאן איברהימוביץ׳', 'FW', '1999-2023', 'Milan', 'goalMachine', 'winner'),
  m('swe_larsson', 'SWE', 'Henrik Larsson', 'הנריק לרסון', 'FW', '1992-2013', 'Celtic', 'goalMachine', 'grinder'),
  m('swe_nordahl', 'SWE', 'Gunnar Nordahl', 'גונאר נורדאל', 'FW', '1940-1958', 'Milan', 'goalMachine', 'grinder'),
  m('swe_brolin', 'SWE', 'Tomas Brolin', 'תומאס ברולין', 'FW', '1987-1998', 'Parma', 'playmaker', 'artist'),
  m('swe_ljungberg', 'SWE', 'Freddie Ljungberg', 'פרדי יונגברג', 'MF', '1994-2012', 'Arsenal', 'europeanCup', 'wanderer'),
  m('swe_hellstrom', 'SWE', 'Ronnie Hellström', 'רוני הלסטרום', 'GK', '1966-1984', 'Kaiserslautern', 'keeper', 'wall'),

  // ---------------------------------------------------------------- Poland
  m('pol_boniek', 'POL', 'Zbigniew Boniek', 'זביגנייב בוניאק', 'FW', '1975-1988', 'Juventus', 'europeanCup', 'wanderer'),
  m('pol_lato', 'POL', 'Grzegorz Lato', 'גז׳גוז׳ לאטו', 'FW', '1967-1987', 'Stal Mielec', 'worldCup', 'grinder'),
  m('pol_deyna', 'POL', 'Kazimierz Deyna', 'קז׳ימייז׳ דיינה', 'MF', '1966-1987', 'Legia Warszawa', 'playmaker', 'artist'),
  m('pol_dudek', 'POL', 'Jerzy Dudek', 'יז׳י דודק', 'GK', '1995-2011', 'Liverpool', 'keeper', 'grinder'),
  m('pol_lubanski', 'POL', 'Włodzimierz Lubański', 'ולודז׳ימייז׳ לובנסקי', 'FW', '1963-1982', 'Górnik Zabrze', 'goalMachine', 'grinder'),
  m('pol_zmuda', 'POL', 'Władysław Żmuda', 'ולדיסלב ז׳מודה', 'DF', '1973-1989', 'Widzew Łódź', 'worldCup', 'wall'),

  // ---------------------------------------------------------------- Romania
  m('rou_hagi', 'ROU', 'Gheorghe Hagi', 'גאורגה האג׳י', 'MF', '1982-2001', 'Galatasaray', 'playmaker', 'artist'),
  m('rou_popescu', 'ROU', 'Gheorghe Popescu', 'גאורגה פופסקו', 'DF', '1985-2003', 'Barcelona', 'captain', 'wall'),
  m('rou_petrescu', 'ROU', 'Dan Petrescu', 'דן פטרסקו', 'DF', '1985-2003', 'Chelsea', 'europeanCup', 'wanderer'),
  m('rou_lacatus', 'ROU', 'Marius Lăcătuș', 'מריוס לקטוש', 'FW', '1982-2000', 'Steaua București', 'europeanCup', 'grinder'),
  m('rou_duckadam', 'ROU', 'Helmuth Duckadam', 'הלמוט דוקדם', 'GK', '1978-1991', 'Steaua București', 'keeper', 'wall'),
  m('rou_mutu', 'ROU', 'Adrian Mutu', 'אדריאן מוטו', 'FW', '1996-2016', 'Fiorentina', 'goalMachine', 'wanderer'),

  // ---------------------------------------------------------------- Hungary
  m('hun_puskas', 'HUN', 'Ferenc Puskás', 'פרנץ פושקאש', 'FW', '1943-1966', 'Real Madrid', 'goalMachine', 'winner'),
  m('hun_kocsis', 'HUN', 'Sándor Kocsis', 'שאנדור קוצ׳יש', 'FW', '1945-1966', 'Barcelona', 'goalMachine', 'wanderer'),
  m('hun_hidegkuti', 'HUN', 'Nándor Hidegkuti', 'נאנדור הידגקוטי', 'FW', '1945-1958', 'MTK Budapest', 'pioneer', 'artist'),
  m('hun_albert', 'HUN', 'Flórián Albert', 'פלוריאן אלברט', 'FW', '1958-1974', 'Ferencváros', 'ballonDor', 'artist'),
  m('hun_grosics', 'HUN', 'Gyula Grosics', 'ג׳ולה גרושיץ׳', 'GK', '1947-1962', 'Honvéd', 'keeper', 'wall'),
  m('hun_detari', 'HUN', 'Lajos Détári', 'לאיוש דטארי', 'MF', '1981-1998', 'Eintracht Frankfurt', 'playmaker', 'wanderer'),

  // ---------------------------------------------------------------- Cyprus
  m('cyp_kaiafas', 'CYP', 'Sotiris Kaiafas', 'סוטיריס קאיאפאס', 'FW', '1968-1985', 'Omonia', 'goalMachine', 'grinder'),
  m('cyp_okkas', 'CYP', 'Yiannakis Okkas', 'יאניס אוקאס', 'FW', '1994-2014', 'Anorthosis', 'captain', 'grinder'),
  m('cyp_konstantinou', 'CYP', 'Michalis Konstantinou', 'מיכאליס קונסטנטינו', 'FW', '1996-2013', 'Panathinaikos', 'goalMachine', 'wanderer'),
  m('cyp_pittas', 'CYP', 'Pambos Pittas', 'פמבוס פיטאס', 'MF', '1974-1990', 'Omonia', 'oneClubMan', 'captain'),
  m('cyp_charalambous', 'CYP', 'Costas Charalambous', 'קוסטס חרלמבוס', 'DF', '1990-2008', 'APOEL', 'captain', 'wall'),
  m('cyp_panayiotou', 'CYP', 'Nikos Panayiotou', 'ניקוס פנאיוטו', 'GK', '1985-2002', 'Omonia', 'keeper', 'wall'),

  // ---------------------------------------------------------------- Argentina
  m('arg_maradona', 'ARG', 'Diego Maradona', 'דייגו מראדונה', 'FW', '1976-1997', 'Napoli', 'worldCup', 'artist'),
  m('arg_kempes', 'ARG', 'Mario Kempes', 'מריו קמפס', 'FW', '1970-1996', 'Valencia', 'worldCup', 'grinder'),
  m('arg_batistuta', 'ARG', 'Gabriel Batistuta', 'גבריאל בטיסטוטה', 'FW', '1988-2005', 'Fiorentina', 'goalMachine', 'wanderer'),
  m('arg_zanetti', 'ARG', 'Javier Zanetti', 'חבייר סאנטי', 'DF', '1992-2014', 'Internazionale Milano', 'oneClubMan', 'captain'),
  m('arg_riquelme', 'ARG', 'Juan Román Riquelme', 'חואן רומן ריקלמה', 'MF', '1996-2014', 'Boca Juniors', 'playmaker', 'artist'),
  m('arg_ayala', 'ARG', 'Roberto Ayala', 'רוברטו איאלה', 'DF', '1993-2010', 'Valencia', 'captain', 'wall'),
  m('arg_fillol', 'ARG', 'Ubaldo Fillol', 'אובלדו פיז׳ול', 'GK', '1969-1991', 'River Plate', 'keeper', 'wall'),

  // ---------------------------------------------------------------- Brazil
  m('bra_pele', 'BRA', 'Pelé', 'פלה', 'FW', '1956-1977', 'Santos', 'worldCup', 'winner'),
  m('bra_ronaldo', 'BRA', 'Ronaldo Nazário', 'רונאלדו נזאריו', 'FW', '1993-2011', 'Internazionale Milano', 'ballonDor', 'wanderer'),
  m('bra_romario', 'BRA', 'Romário', 'רומאריו', 'FW', '1985-2009', 'Barcelona', 'goalMachine', 'artist'),
  m('bra_cafu', 'BRA', 'Cafu', 'קאפו', 'DF', '1989-2008', 'Milan', 'captain', 'captain'),
  m('bra_robertocarlos', 'BRA', 'Roberto Carlos', 'רוברטו קרלוס', 'DF', '1991-2015', 'Real Madrid', 'europeanCup', 'winner'),
  m('bra_socrates', 'BRA', 'Sócrates', 'סוקראטס', 'MF', '1974-1989', 'Corinthians', 'playmaker', 'artist'),
  m('bra_taffarel', 'BRA', 'Cláudio Taffarel', 'קלאודיו טאפארל', 'GK', '1985-2003', 'Galatasaray', 'keeper', 'grinder'),

  // ---------------------------------------------------------------- United States
  m('usa_donovan', 'USA', 'Landon Donovan', 'לנדון דונובן', 'FW', '2001-2016', 'LA Galaxy', 'goalMachine', 'winner'),
  m('usa_dempsey', 'USA', 'Clint Dempsey', 'קלינט דמפסי', 'FW', '2004-2018', 'Fulham', 'pioneer', 'grinder'),
  m('usa_friedel', 'USA', 'Brad Friedel', 'בראד פרידל', 'GK', '1992-2015', 'Blackburn Rovers', 'keeper', 'grinder'),
  m('usa_howard', 'USA', 'Tim Howard', 'טים הווארד', 'GK', '1997-2019', 'Everton', 'keeper', 'wall'),
  m('usa_reyna', 'USA', 'Claudio Reyna', 'קלאודיו ריינה', 'MF', '1994-2008', 'Rangers', 'captain', 'captain'),
  m('usa_mcbride', 'USA', 'Brian McBride', 'בריאן מקברייד', 'FW', '1994-2010', 'Fulham', 'pioneer', 'wanderer'),
  m('usa_pope', 'USA', 'Eddie Pope', 'אדי פופ', 'DF', '1996-2007', 'DC United', 'oneClubMan', 'wall'),
];

/** The mentors a player from this country can approach. */
export function mentorsFor(countryCode: string): MentorDef[] {
  return MENTORS.filter((mentor) => mentor.country === countryCode);
}
