import type { NamePool } from '@fc/engine';

/** Name pools for procedurally generated players, one per locale. */
export const NAME_POOLS: NamePool[] = [
  {
    locale: 'ua',
    first: ['Andriy', 'Oleksandr', 'Serhiy', 'Vitaliy', 'Bohdan', 'Yuriy', 'Denys', 'Mykola', 'Ruslan', 'Taras', 'Ihor', 'Roman', 'Vadym', 'Artem', 'Maksym', 'Yevhen', 'Volodymyr', 'Dmytro', 'Oleh', 'Pavlo', 'Nazar', 'Illia', 'Kyrylo', 'Stanislav', 'Anton', 'Vasyl', 'Ostap', 'Marko', 'Levko', 'Danylo'],
    last: ['Shevchenko', 'Kovalenko', 'Bondarenko', 'Tkachenko', 'Kravchuk', 'Melnyk', 'Boyko', 'Marchenko', 'Lysenko', 'Rudenko', 'Sydorenko', 'Hrytsenko', 'Pavlenko', 'Zinchenko', 'Yaremchuk', 'Malinovskyi', 'Stepanenko', 'Kharatin', 'Bilyk', 'Hutsulyak', 'Dovbyk', 'Mudryk', 'Tsyhankov', 'Sobol', 'Karavaev', 'Trubin', 'Buletsa', 'Vanat', 'Brazhko', 'Shaparenko'],
  },
  {
    locale: 'cz',
    first: ['Jakub', 'Tomas', 'Petr', 'Martin', 'Ondrej', 'Lukas', 'David', 'Vojtech', 'Filip', 'Adam', 'Jan', 'Michal', 'Daniel', 'Matej', 'Patrik', 'Radek', 'Marek', 'Vaclav', 'Josef', 'Karel', 'Milan', 'Stanislav', 'Zdenek', 'Ladislav', 'Antonin', 'Roman', 'Pavel', 'Jiri', 'Miroslav', 'Dominik'],
    last: ['Novak', 'Svoboda', 'Novotny', 'Dvorak', 'Cerny', 'Prochazka', 'Kucera', 'Vesely', 'Horak', 'Nemec', 'Pospisil', 'Marek', 'Kral', 'Benes', 'Fiala', 'Sedlacek', 'Dolezal', 'Zeman', 'Kolar', 'Ruzicka', 'Soucek', 'Coufal', 'Schick', 'Hlozek', 'Barak', 'Jankto', 'Krejci', 'Masopust', 'Vydra', 'Holes'],
  },
  {
    locale: 'hr',
    first: ['Marko', 'Ivan', 'Luka', 'Josip', 'Ante', 'Mateo', 'Nikola', 'Filip', 'Dario', 'Tomislav', 'Domagoj', 'Petar', 'Karlo', 'Mislav', 'Bruno', 'Andrej', 'Borna', 'Duje', 'Fran', 'Toni', 'Stipe', 'Roko', 'Lovro', 'Josko', 'Dominik', 'Kristijan', 'Marin', 'Franjo', 'Matija', 'Ivica'],
    last: ['Horvat', 'Kovacevic', 'Babic', 'Maric', 'Novak', 'Juric', 'Kovacic', 'Vukovic', 'Peric', 'Matic', 'Modric', 'Perisic', 'Brozovic', 'Gvardiol', 'Sosa', 'Petkovic', 'Pasalic', 'Sucic', 'Livaja', 'Stanisic', 'Erlic', 'Vlasic', 'Majer', 'Ivanusec', 'Baturina', 'Moro', 'Sutalo', 'Budimir', 'Kramaric', 'Jakic'],
  },
  {
    locale: 'rs',
    first: ['Nikola', 'Marko', 'Stefan', 'Aleksandar', 'Milos', 'Nemanja', 'Luka', 'Filip', 'Dusan', 'Uros', 'Lazar', 'Vukasin', 'Petar', 'Dragan', 'Bogdan', 'Andrija', 'Veljko', 'Strahinja', 'Ognjen', 'Mihailo', 'Nenad', 'Vladimir', 'Milan', 'Zoran', 'Ivan', 'Sasa', 'Bojan', 'Predrag', 'Djordje', 'Relja'],
    last: ['Jovanovic', 'Petrovic', 'Nikolic', 'Markovic', 'Djordjevic', 'Stojanovic', 'Ilic', 'Stankovic', 'Pavlovic', 'Milosevic', 'Mitrovic', 'Vlahovic', 'Tadic', 'Kostic', 'Zivkovic', 'Lukic', 'Gudelj', 'Veljkovic', 'Radonjic', 'Samardzic', 'Milinkovic', 'Grujic', 'Babic', 'Erakovic', 'Rajkovic', 'Terzic', 'Maksimovic', 'Jovic', 'Simic', 'Krstic'],
  },
  {
    locale: 'dk',
    first: ['Mikkel', 'Kasper', 'Frederik', 'Emil', 'Rasmus', 'Anders', 'Magnus', 'Jonas', 'Nikolaj', 'Christian', 'Mads', 'Lasse', 'Oliver', 'Victor', 'Simon', 'Andreas', 'Jesper', 'Marcus', 'Tobias', 'Sebastian', 'Alexander', 'Joachim', 'Nicolai', 'Patrick', 'Daniel', 'Martin', 'Soren', 'Thomas', 'Jeppe', 'Villads'],
    last: ['Jensen', 'Nielsen', 'Hansen', 'Pedersen', 'Andersen', 'Christensen', 'Larsen', 'Sorensen', 'Rasmussen', 'Jorgensen', 'Petersen', 'Madsen', 'Kristensen', 'Olsen', 'Thomsen', 'Christiansen', 'Poulsen', 'Johansen', 'Knudsen', 'Mortensen', 'Skov', 'Damsgaard', 'Hojbjerg', 'Dolberg', 'Braithwaite', 'Wind', 'Maehle', 'Kjaer', 'Andreasen', 'Bruun'],
  },
  {
    locale: 'no',
    first: ['Erling', 'Martin', 'Kristian', 'Sander', 'Jonas', 'Mathias', 'Andreas', 'Marius', 'Sondre', 'Emil', 'Fredrik', 'Henrik', 'Magnus', 'Ole', 'Jorgen', 'Even', 'Simen', 'Tobias', 'Aron', 'Leo', 'Iver', 'Kasper', 'Vetle', 'Filip', 'Petter', 'Anders', 'Sindre', 'Elias', 'Herman', 'Oskar'],
    last: ['Hansen', 'Johansen', 'Olsen', 'Larsen', 'Andersen', 'Pedersen', 'Nilsen', 'Kristiansen', 'Jensen', 'Karlsen', 'Johnsen', 'Pettersen', 'Eriksen', 'Berg', 'Haaland', 'Odegaard', 'Sorloth', 'Berge', 'Elyounoussi', 'Ryerson', 'Aursnes', 'Strand', 'Nusa', 'Bobb', 'Ostigard', 'Thorsby', 'Nordtveit', 'Hauge', 'Solbakken', 'Myhre'],
  },
  {
    locale: 'se',
    first: ['Viktor', 'Emil', 'Anton', 'Oscar', 'Gustav', 'Hugo', 'Elias', 'Axel', 'Isak', 'Filip', 'Alexander', 'Jesper', 'Simon', 'Kevin', 'Sebastian', 'Adam', 'Erik', 'Ludwig', 'Marcus', 'Robin', 'Joel', 'Linus', 'Melker', 'Noah', 'Rasmus', 'Samuel', 'Theo', 'Vilmer', 'Albin', 'Nils'],
    last: ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson', 'Lindberg', 'Berg', 'Isak', 'Gyokeres', 'Elanga', 'Kulusevski', 'Forsberg', 'Olsen', 'Bergvall', 'Ayari', 'Nygren', 'Hjulmand', 'Claesson', 'Ekdal', 'Krafth', 'Lindelof', 'Danielson', 'Holm', 'Sundberg', 'Ahlberg'],
  },
  {
    locale: 'pl',
    first: ['Jakub', 'Piotr', 'Michal', 'Bartosz', 'Kacper', 'Mateusz', 'Filip', 'Szymon', 'Adam', 'Krzysztof', 'Damian', 'Pawel', 'Marcin', 'Tomasz', 'Lukasz', 'Sebastian', 'Dawid', 'Kamil', 'Rafal', 'Wojciech', 'Grzegorz', 'Karol', 'Przemyslaw', 'Arkadiusz', 'Bartlomiej', 'Maciej', 'Jan', 'Nikodem', 'Oliwier', 'Igor'],
    last: ['Nowak', 'Kowalski', 'Wisniewski', 'Wojcik', 'Kowalczyk', 'Kaminski', 'Lewandowski', 'Zielinski', 'Szymanski', 'Wozniak', 'Dabrowski', 'Kozlowski', 'Jankowski', 'Mazur', 'Krawczyk', 'Piotrowski', 'Grabowski', 'Nowicki', 'Pawlowski', 'Michalski', 'Zalewski', 'Milik', 'Bednarek', 'Frankowski', 'Skorupski', 'Cash', 'Kiwior', 'Buksa', 'Slisz', 'Urbanski'],
  },
  {
    locale: 'ro',
    first: ['Andrei', 'Alexandru', 'Ionut', 'Cristian', 'Gabriel', 'Razvan', 'Vlad', 'Bogdan', 'Marius', 'Florin', 'Denis', 'Stefan', 'Nicolae', 'Adrian', 'Daniel', 'Mihai', 'Valentin', 'Sergiu', 'Catalin', 'Robert', 'Darius', 'Octavian', 'Claudiu', 'Iulian', 'Dragos', 'Silviu', 'Paul', 'Lucian', 'Ovidiu', 'Rares'],
    last: ['Popescu', 'Ionescu', 'Popa', 'Stan', 'Dumitru', 'Radu', 'Munteanu', 'Constantin', 'Georgescu', 'Marin', 'Stoica', 'Barbu', 'Nistor', 'Tudor', 'Dobre', 'Coman', 'Cicaldau', 'Hagi', 'Mitrita', 'Puscas', 'Dragusin', 'Marin', 'Man', 'Sorescu', 'Baluta', 'Chiriches', 'Nedelcearu', 'Cordea', 'Olaru', 'Birligea'],
  },
  {
    locale: 'hu',
    first: ['Bence', 'Adam', 'Daniel', 'Mate', 'Balazs', 'Peter', 'Zsolt', 'Gergo', 'Tamas', 'Attila', 'Roland', 'Krisztian', 'Norbert', 'Marton', 'Levente', 'Andras', 'Laszlo', 'Zoltan', 'Istvan', 'Gabor', 'Milan', 'Botond', 'Kevin', 'Patrik', 'Barnabas', 'Csaba', 'Erik', 'Akos', 'Donat', 'Imre'],
    last: ['Nagy', 'Kovacs', 'Toth', 'Szabo', 'Horvath', 'Varga', 'Kiss', 'Molnar', 'Nemeth', 'Farkas', 'Balogh', 'Papp', 'Lakatos', 'Takacs', 'Juhasz', 'Meszaros', 'Olah', 'Simon', 'Racz', 'Fekete', 'Szoboszlai', 'Sallai', 'Gulacsi', 'Orban', 'Schafer', 'Bolla', 'Kerkez', 'Styles', 'Varga', 'Csoboth'],
  },

  {
    locale: 'en',
    first: ['Jack', 'Harry', 'Callum', 'Ollie', 'Reece', 'Tyler', 'Kyle', 'Lewis', 'Josh', 'Mason', 'Alfie', 'Charlie', 'Dan', 'Connor', 'Ethan', 'Jamie', 'Louie', 'Ryan', 'Sam', 'Freddie', 'Marcus', 'Jordan', 'Aaron', 'Nathan', 'Elliot', 'Kieran', 'Dominic', 'Toby', 'Leon', 'Curtis'],
    last: ['Smith', 'Wright', 'Baker', 'Hughes', 'Turner', 'Bennett', 'Clarke', 'Fletcher', 'Nolan', 'Whitfield', 'Ashcroft', 'Doyle', 'Redmond', 'Grant', 'Kavanagh', 'Sinclair', 'Howells', 'Ramsey', 'Duffield', 'Pearson', 'Stokes', 'Radford', 'Bramley', 'Colston', 'Hedges', 'Marsden', 'Alderton', 'Prescott', 'Vaughan', 'Winstone'],
  },
  {
    locale: 'es',
    first: ['Alvaro', 'Sergio', 'Javier', 'Pablo', 'Marcos', 'Iker', 'Adrian', 'Hugo', 'Nacho', 'Rodrigo', 'Diego', 'Aitor', 'Unai', 'Borja', 'Mikel', 'Gonzalo', 'Ruben', 'Ivan', 'Joel', 'Cesar', 'Dani', 'Fran', 'Oscar', 'Raul', 'Alejandro', 'Nico', 'Bruno', 'Izan', 'Ander', 'Guillem'],
    last: ['Garcia', 'Fernandez', 'Lopez', 'Moreno', 'Serrano', 'Vidal', 'Cabrera', 'Peralta', 'Escudero', 'Quintana', 'Navarro', 'Zamora', 'Bustos', 'Iglesias', 'Salinas', 'Villalba', 'Ferrer', 'Barrios', 'Aguirre', 'Cardenas', 'Requena', 'Otero', 'Mendoza', 'Palacios', 'Cuesta', 'Herrera', 'Bautista', 'Rivas', 'Cortes', 'Delgado'],
  },
  {
    locale: 'it',
    first: ['Lorenzo', 'Matteo', 'Andrea', 'Francesco', 'Alessandro', 'Davide', 'Simone', 'Gabriele', 'Nicolo', 'Federico', 'Riccardo', 'Tommaso', 'Marco', 'Stefano', 'Luca', 'Giacomo', 'Emanuele', 'Filippo', 'Cristian', 'Michele', 'Samuele', 'Edoardo', 'Antonio', 'Pietro', 'Salvatore', 'Domenico', 'Vincenzo', 'Raffaele', 'Fabio', 'Enrico'],
    last: ['Rossi', 'Bianchi', 'Conti', 'Ferrari', 'Greco', 'Marchetti', 'Fontana', 'Barbieri', 'Rinaldi', 'Caputo', 'Vitale', 'Pagano', 'Serra', 'Longo', 'Mancini', 'Villa', 'Cattaneo', 'Sartori', 'Gentile', 'De Luca', 'Palmieri', 'Bernardi', 'Orlando', 'Fabbri', 'Piras', 'Gallo', 'Testa', 'Riva', 'Moretti', 'Grasso'],
  },
  {
    locale: 'de',
    first: ['Lukas', 'Jonas', 'Finn', 'Leon', 'Maximilian', 'Niklas', 'Tim', 'Julian', 'Philipp', 'Fabian', 'Marvin', 'Jannik', 'Nico', 'Tobias', 'Dennis', 'Marc', 'Sebastian', 'Kevin', 'Florian', 'Simon', 'Moritz', 'Erik', 'Jannis', 'Sven', 'Pascal', 'Robin', 'Malte', 'Til', 'Hendrik', 'Ole'],
    last: ['Müller', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Meier', 'Lehmann', 'Köhler', 'Herrmann', 'Walter', 'König', 'Sommer'],
  },
  {
    locale: 'he',
    first: ['עומרי', 'איתן', 'ירדן', 'נועם', 'עידן', 'גיא', 'אורי', 'רועי', 'שלו', 'לירן', 'אביב', 'דור', 'נדב', 'תומר', 'יובל', 'עמית', 'איתי', 'ברק', 'אלעד', 'גל', 'מאור', 'אופק', 'שגיא', 'עילאי', 'רן', 'יונתן', 'אסף', 'בר', 'ליאור', 'שי', 'אלמוג', 'ניר', 'עידו', 'רותם', 'יהב', 'עומר', 'איתמר', 'אלון', 'אריאל', 'בן', 'דניאל', 'הלל', 'זיו', 'חן', 'טל', 'יאיר', 'ידידיה', 'יהונתן', 'יותם', 'כפיר', 'לביא', 'מתן', 'נועה', 'ניב', 'סהר', 'עדי', 'עוז', 'עמרי', 'פלג', 'צור', 'קרן', 'רועה', 'רוני', 'שחר', 'שקד', 'תמיר', 'אביתר', 'אדם', 'אוראל', 'אושרי', 'אלירן', 'אמיר', 'אסיף', 'ארבל', 'בועז', 'גיל', 'גלעד', 'דביר', 'הראל', 'ויקטור', 'זוהר', 'חגי', 'יהלי', 'יובלי', 'ליאם', 'מגד', 'נבו', 'סער', 'עברי', 'עידני', 'רותם', 'רן־אל', 'שלומי', 'תום'],
    last: ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'דהן', 'אזולאי', 'מלכה', 'אוחנה', 'בן דוד', 'שלום', 'עמר', 'גבאי', 'חדד', 'יוסף', 'ברדה', 'תורג׳מן', 'זוהר', 'אלבז', 'ניסים', 'סבג', 'אשכנזי', 'כץ', 'סגל', 'גולן', 'הרוש', 'זגורי', 'בוזגלו', 'ועקנין', 'שטרית', 'אוחיון', 'ביטן', 'נחום', 'אדרי', 'שרעבי', 'אברהמי', 'אדרעי', 'אוחנונה', 'אליהו', 'אלמליח', 'אמסלם', 'אפריאט', 'אשר', 'בביוף', 'בוסקילה', 'בן חמו', 'בן שבת', 'בן שושן', 'ברוך', 'ברזילי', 'גדסי', 'גוזלן', 'גל־און', 'גרשון', 'דוד', 'דיין', 'דנינו', 'הדר', 'הכהן', 'ואקנין', 'זכריה', 'חזן', 'חיים', 'חמו', 'טויטו', 'טל', 'יהודה', 'ימין', 'כרמלי', 'לביא', 'לוגסי', 'מוסקוביץ', 'מור', 'מיארה', 'מימון', 'מנשה', 'נגר', 'נהרי', 'נוימן', 'סויסה', 'סולומון', 'סיטון', 'עדן', 'עטיה', 'עמרם', 'פדידה', 'פרידמן', 'צדוק', 'צרפתי', 'קדוש', 'קליין', 'קרן', 'רביבו', 'רוזן', 'רחמים', 'שגב', 'שוורץ', 'שמעוני', 'שפירא', 'תורגמן'],
  },
  {
    locale: 'fr',
    first: ['Lucas', 'Enzo', 'Hugo', 'Theo', 'Nathan', 'Mathis', 'Yanis', 'Kylian', 'Noa', 'Ilan', 'Jules', 'Axel', 'Amine', 'Rayan', 'Bilal', 'Kenzo', 'Evan', 'Malo', 'Clement', 'Thibault', 'Baptiste', 'Corentin', 'Maxence', 'Ibrahim', 'Sofiane', 'Adrien', 'Romain', 'Quentin', 'Loic', 'Dylan'],
    last: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garnier', 'Faure', 'Rousseau', 'Blanc', 'Guerin', 'Boyer', 'Marchand', 'Duval', 'Gaillard', 'Barre', 'Perrin', 'Fournier', 'Colin', 'Vidal', 'Caron', 'Renard', 'Bonnet'],
  },
  {
    locale: 'pt',
    first: ['Joao', 'Pedro', 'Rafael', 'Tiago', 'Diogo', 'Bruno', 'Rui', 'Andre', 'Miguel', 'Goncalo', 'Fabio', 'Ricardo', 'Nuno', 'Vitor', 'Hugo', 'Daniel', 'Luis', 'Filipe', 'Duarte', 'Simao', 'Bernardo', 'Afonso', 'Gabriel', 'Marco', 'Renato', 'Sergio', 'Paulo', 'Henrique', 'Leandro', 'Ivo'],
    last: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Sousa', 'Fonseca', 'Ribeiro', 'Carvalho', 'Teixeira', 'Almeida', 'Lopes', 'Marques', 'Cardoso', 'Moreira', 'Neves', 'Pinto', 'Correia', 'Barbosa', 'Machado', 'Freitas', 'Cunha', 'Azevedo', 'Nogueira', 'Tavares', 'Braga', 'Faria'],
  },
  {
    locale: 'nl',
    first: ['Daan', 'Sem', 'Lars', 'Bram', 'Thijs', 'Jesse', 'Ruben', 'Sven', 'Tim', 'Milan', 'Stijn', 'Joris', 'Niels', 'Koen', 'Bas', 'Jelle', 'Rick', 'Teun', 'Wessel', 'Sander', 'Floris', 'Mees', 'Gijs', 'Guus', 'Jasper', 'Roel', 'Nick', 'Pim', 'Kars', 'Hidde'],
    last: ['de Jong', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Leeuwen', 'Dekker', 'Brouwer', 'de Wit', 'Dijkstra', 'van den Berg', 'Kuipers', 'Jansen', 'Willems', 'Blom', 'Kok', 'Verhoeven', 'Schouten', 'van Vliet', 'Post', 'Timmermans', 'Kramer'],
  },
  {
    locale: 'tr',
    first: ['Emre', 'Mert', 'Burak', 'Kerem', 'Cengiz', 'Ozan', 'Yusuf', 'Berkay', 'Arda', 'Halil', 'Enes', 'Ismail', 'Umut', 'Kaan', 'Serdar', 'Baris', 'Onur', 'Efe', 'Tolga', 'Sinan', 'Batuhan', 'Ahmet', 'Furkan', 'Volkan', 'Deniz', 'Eren', 'Okan', 'Sefa', 'Yunus', 'Caner'],
    last: ['Yilmaz', 'Demir', 'Kaya', 'Celik', 'Sahin', 'Yildiz', 'Ozturk', 'Aydin', 'Arslan', 'Dogan', 'Kilic', 'Aslan', 'Cetin', 'Kara', 'Koc', 'Kurt', 'Ozdemir', 'Simsek', 'Polat', 'Erdogan', 'Tekin', 'Gunes', 'Bulut', 'Aksoy', 'Turan', 'Yalcin', 'Toprak', 'Sari', 'Bayram', 'Ercan'],
  },
  {
    locale: 'gr',
    first: ['Giorgos', 'Dimitris', 'Nikos', 'Kostas', 'Vasilis', 'Christos', 'Panagiotis', 'Stavros', 'Ilias', 'Thanasis', 'Petros', 'Manolis', 'Alexandros', 'Michalis', 'Sotiris', 'Lefteris', 'Antonis', 'Stefanos', 'Fotis', 'Andreas'],
    last: ['Papadopoulos', 'Georgiou', 'Nikolaou', 'Vlachos', 'Karagiannis', 'Antoniou', 'Makris', 'Samaras', 'Pappas', 'Christodoulou', 'Katsaros', 'Fotiadis', 'Manolas', 'Stavrou', 'Tsakiris', 'Zafeiris', 'Lambrou', 'Doukas', 'Rigas', 'Kyriakidis'],
  },
];
