/**
 * The fixtures that are not just three points.
 *
 * A derby is not a stronger opponent, it is a different week: the build-up starts on
 * the Monday, the crowd is louder, and a good afternoon is remembered for years. The
 * pairs are listed by club id, both ways round, and anything in the same city is
 * treated as a derby automatically by the engine.
 */

export const RIVALRIES: [string, string][] = [
  // England
  ['eng_liverpool_fc', 'eng_everton_fc'],
  ['eng_liverpool_fc', 'eng_manchester_united_fc'],
  ['eng_manchester_united_fc', 'eng_manchester_city_fc'],
  ['eng_arsenal_fc', 'eng_tottenham_hotspur_fc'],
  ['eng_arsenal_fc', 'eng_chelsea_fc'],
  ['eng_chelsea_fc', 'eng_tottenham_hotspur_fc'],
  ['eng_newcastle_united_fc', 'eng_sunderland_afc'],
  ['eng_aston_villa_fc', 'eng_birmingham_city_fc'],
  ['eng_nottingham_forest_fc', 'eng_derby_county_fc'],
  ['eng_sheffield_united_fc', 'eng_sheffield_wednesday_fc'],
  ['eng_west_ham_united_fc', 'eng_millwall_fc'],
  ['eng_portsmouth_fc', 'eng_southampton_fc'],
  ['eng_leeds_united_fc', 'eng_manchester_united_fc'],

  // Spain
  ['esp_real_madrid_cf', 'esp_fc_barcelona'],
  ['esp_real_madrid_cf', 'esp_club_atletico_de_madrid'],
  ['esp_fc_barcelona', 'esp_rcd_espanyol_de_barcelona'],
  ['esp_sevilla_fc', 'esp_real_betis_balompie'],
  ['esp_athletic_club', 'esp_real_sociedad_de_futbol'],
  ['esp_valencia_cf', 'esp_villarreal_cf'],

  // Italy
  ['ita_fc_internazionale_milano', 'ita_ac_milan'],
  ['ita_as_roma', 'ita_ss_lazio'],
  ['ita_juventus_fc', 'ita_fc_internazionale_milano'],
  ['ita_juventus_fc', 'ita_torino_fc'],
  ['ita_ssc_napoli', 'ita_as_roma'],
  ['ita_genoa_cfc', 'ita_uc_sampdoria'],

  // Germany
  ['ger_borussia_dortmund', 'ger_fc_schalke_04'],
  ['ger_fc_bayern_munchen', 'ger_borussia_dortmund'],
  ['ger_fc_bayern_munchen', 'ger_tsv_1860_munchen'],
  ['ger_hamburger_sv', 'ger_fc_st_pauli'],
  ['ger_1_fc_koln', 'ger_borussia_monchengladbach'],

  // Israel
  ['isr_maccabi_tel_aviv', 'isr_hapoel_tel_aviv'],
  ['isr_maccabi_haifa', 'isr_hapoel_haifa'],
  ['isr_beitar_jerusalem', 'isr_hapoel_jerusalem'],
  ['isr_maccabi_tel_aviv', 'isr_maccabi_haifa'],
  ['isr_beitar_jerusalem', 'isr_maccabi_tel_aviv'],

  // Elsewhere
  ['por_sl_benfica', 'por_fc_porto'],
  ['por_sl_benfica', 'por_sporting_cp'],
  ['ned_ajax', 'ned_feyenoord'],
  ['ned_ajax', 'ned_psv'],
  ['tur_galatasaray', 'tur_fenerbahce'],
  ['tur_besiktas', 'tur_galatasaray'],
  ['gre_olympiakos_piraus', 'gre_panathinaikos'],
  ['gre_paok_saloniki', 'gre_aris_saloniki'],
  ['sco_celtic_fc', 'sco_rangers_fc'],
  ['fra_olympique_marseille', 'fra_paris_saint_germain'],
  ['fra_olympique_lyonnais', 'fra_as_saint_etienne'],
  ['at_fk_austria_wien', 'at_sk_rapid_wien'],
];
