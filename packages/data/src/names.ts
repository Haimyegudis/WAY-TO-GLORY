import type { NamePool } from '@fc/engine';

/** Name pools for procedurally generated players, one per locale. */
export const NAME_POOLS: NamePool[] = [
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
    first: ['Omri', 'Eitan', 'Yarden', 'Noam', 'Idan', 'Guy', 'Ori', 'Roi', 'Shalev', 'Liran', 'Aviv', 'Dor', 'Nadav', 'Tomer', 'Yuval', 'Amit', 'Itay', 'Barak', 'Elad', 'Gal', 'Maor', 'Ofek', 'Sagiv', 'Ilay', 'Ran', 'Yonatan', 'Assaf', 'Bar', 'Lior', 'Shai'],
    last: ['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Dahan', 'Azoulay', 'Malka', 'Ohana', 'Ben David', 'Shalom', 'Amar', 'Gabay', 'Hadad', 'Yosef', 'Barda', 'Turgeman', 'Zohar', 'Elbaz', 'Nissim', 'Sabag', 'Ashkenazi', 'Katz', 'Segal', 'Golan', 'Harush', 'Zaguri', 'Buzaglo', 'Vaknin', 'Shitrit'],
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
