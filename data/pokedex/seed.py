"""Curación explícita. Coordenadas de muestreo regional aproximadas, no parcelas."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
SOURCES={
'melomys':('Australian assessment of the Bramble Cay melomys, 2018','https://www.dcceew.gov.au/sites/default/files/env/consultations/d678432e-1ee8-4316-b1ef-af29634401d7/files/consultation-document-bramble-cay-melomys-2018.pdf'),
'erub':('Erub (Darnley Island) local plan','https://tsirc.qld.gov.au/wp-content/uploads/2024/11/Part-7-Erub-Darnley-Island-local-plan-code.pdf'),
'golden':('IUCN: Golden Toad','https://nc.iucnredlist.org/redlist/amazing-species/incilius-periglenes/pdfs/original/incilius-periglenes.pdf'),
'golden_climate':('Anchukaitis and Evans, 2010: climate variability and the golden toad','https://pubmed.ncbi.nlm.nih.gov/20194772/'),
'atelopus':('IUCN Amphibian Specialist Group, 2020 update','https://www.iucn-amphibians.org/iucn-red-list-update/'),
'gastric':('Australian Museum: Australia’s Lost Frogs','https://australian.museum/learn/animals/frogs/herpetology-collection-australias-lost-frogs/'),
'rufum':('Chile: recovery plan for Darwin’s frogs, 2026','https://www.diariooficial.interior.gob.cl/publicaciones/2026/04/09/44420/01/2791873.pdf'),
'snail':('Hawaii DLNR: death of the last known Achatinella apexfulva, 2019','https://dlnr.hawaii.gov/blog/2019/01/04/nr19-001/'),
'poouli':('USFWS: species delisted due to extinction','https://ecos.fws.gov/ecp/report/species-delisted'),
'poouli_habitat':('Hawaii DLNR: Poʻouli','https://dlnr.hawaii.gov/wildlife/birds/poouli/'),
'tecopa':('USFWS: extinction of the Tecopa pupfish, 1981','https://www.fws.gov/sites/default/files/documents/historic-news-releases/1981/19811118.PDF'),
'millepora':('IUCN Millepora boschmai, assessment published 2024','https://doi.org/10.2305/IUCN.UK.2024-2.RLTS.T133300A174746646.en'),
'azurina':('Charles Darwin Foundation: Azurina eupalama','https://datazone.darwinfoundation.org/en/checklist/?species=13668'),
'azurina_pe':('IUCN: possibly extinct species, 2019','https://nc.iucnredlist.org/redlist/content/attachment_files/2019_1_RL_Stats_Table_9.pdf'),
'skink':('Australia State of the Environment 2021: biodiversity','https://soe.dcceew.gov.au/overview/environment/biodiversity'),
'skink_detail':('Australian assessment of Emoia nativitatis','https://www.dcceew.gov.au/sites/default/files/env/consultations/27bdb669-bdd2-4778-b679-652da87c20c1/files/consultation-document-emoia-nativitatus.pdf'),
'catarina':('Valdés González et al.: extinction of Megupsilon aporus, Oryx','https://www.cambridge.org/core/journals/oryx/article/extinction-of-the-catarina-pupfish-megupsilon-aporus-and-the-implications-for-the-conservation-of-freshwater-fish-in-mexico/B13134408D6EDDA38FEB6D9A474E2154'),
'handfish':('IUCN Sympterichthys unipennis, 2021 review','https://doi.org/10.2305/IUCN.UK.2021-3.RLTS.T123423283A207621852.en'),
'bat':('Australia State of the Environment 2021: mammals','https://soe.dcceew.gov.au/sites/default/files/2022-07/soe2021-biodiversity.pdf'),
'bat_habitat':('Australian plan for the Christmas Island pipistrelle','https://www.dcceew.gov.au/sites/default/files/documents/pipistrelle-murrayi.pdf'),
'rabbs':('IUCN Ecnomiohyla rabborum, published 2019','https://doi.org/10.2305/IUCN.UK.2019-1.RLTS.T85341796A54357363.en'),
'rabbs_habitat':('AMNH: Ecnomiohyla rabborum','https://amphibiansoftheworld.amnh.org/Amphibia/Anura/Hylidae/Ecnomiohyla/Ecnomiohyla-rabborum'),
'power':('NASA POWER, meteorology methodology','https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/'),
'hamed':('Hamed and Rao, 1998','https://doi.org/10.1016/S0022-1694(97)00125-X')}

# ID, nombre, latitud, longitud; resolución de muestreo regional elegida por el analista.
LOCATIONS=[
('bramble-cay','Bramble Cay',-9.14244,143.877),('erub','Erub',-9.589,143.771),('funafuti','Funafuti',-8.524,179.195),('alice-springs','Alice Springs',-23.698,133.88),
('monteverde','Monteverde, regional setting',10.30,-84.80),('san-gerardo','San Gerardo de Dota, regional setting',9.55,-83.80),
('talamanca','Talamanca, regional setting',9.40,-83.50),('boquete','Boquete, regional setting',8.78,-82.43),
('conondale','Conondale, regional setting',-26.70,152.60),('lamington','Lamington, regional setting',-28.23,153.13),
('nahuelbuta','Nahuelbuta, historical regional setting',-37.80,-73.00),('valdivia','Valdivia, regional comparison',-39.81,-73.25),
('koolau','Koʻolau, Oʻahu, regional setting',21.45,-157.85),('hanawi','Hanawi, Maui, regional setting',20.75,-156.15),
('hakalau','Hakalau, Hawaiʻi, regional comparison',19.82,-155.30),('tecopa','Tecopa Hot Springs, regional setting',35.88,-116.23),
('coiba','Coiba, marine regional setting',7.60,-81.70),('galapagos','Santa Cruz, Galápagos, regional setting',-0.75,-90.30),
('christmas','Christmas Island, regional setting',-10.48,105.62),('cocos','Cocos (Keeling), regional comparison',-12.16,96.87),
('el-potosi','El Potosí, Nuevo León, regional setting',24.87,-100.33),('tasmania','D’Entrecasteaux Channel, regional setting',-43.20,147.20),
('el-valle','El Valle de Antón, regional setting',8.63,-80.08),('santa-fe','Santa Fe, Panama, regional comparison',8.51,-81.08)]

# Fichas de menos de 200 palabras por fuente; umbrales del PDF se conservan como no validados.
ROWS=[
(1,'melomys','Bramble Cay melomys','Melomys rubicola','Mammal','terrestrial','Extinct','Australian assessment 2018 / federal listing 2019','Australia · Torres Strait','bramble-cay',2009,
 'Herbaceous vegetation on a low coral cay.','Seawater inundation and vegetation loss support the climate link in this case.','documented','melomys erub','Elevation >15 m; 25–31 °C: do not use as proven tolerances.',['plot elevation','seawater inundation','vegetation/food','invasive predators'],'erub'),
(2,'sapo-dorado','Golden toad','Incilius periglenes','Amphibian','terrestrial','Extinct','IUCN species account','Costa Rica · Monteverde','monteverde',1989,
 'Cloud forest and temporary breeding pools.','ENSO-related drought and disease have been proposed; attribution specifically to human-caused warming is disputed.','disputed','golden golden_climate','14–19 °C; RH >90 %: no tolerance source in the brief.',['mist','pool hydroperiod','forest cover','chytrid fungus'],'san-gerardo'),
(3,'arlequin-chiriqui','Chiriquí harlequin frog','Atelopus chiriquiensis','Amphibian','terrestrial','Extinct','IUCN ASG, 2020','Costa Rica and Panama · Talamanca','talamanca',1996,
 'Montane forest and streams.','The decline is attributed at least partly to chytridiomycosis; warming is not shown here to be the sole cause.','not_established','atelopus','12–17 °C in streams: range not validated.',['water temperature','dissolved oxygen','stream flow','chytrid fungus'],'boquete'),
(4,'rana-gastrica','Southern gastric-brooding frog','Rheobatrachus silus','Amphibian','terrestrial','Extinct','Australian Museum / IUCN 2022','Australia · Queensland','conondale',1981,
 'Forest streams in the Conondale and Blackall ranges.','The causes were not resolved before it disappeared; disease is a leading hypothesis. Do not infer climate causation from these series.','not_established','gastric','15–20 °C water: not verified as a tolerance.',['water temperature','stream flow','riparian forest','pathogens'],'lamington'),
(5,'darwin-norte','Northern Darwin’s frog','Rhinoderma rufum','Amphibian','terrestrial','Critically Endangered, possibly extinct','Official Chilean plan, 2026','Chile · central and south-central zone','nahuelbuta',1981,
 'Native forest and streams; regional climate point, not a confirmed current population.','Not recorded since 1981. Habitat loss and disease need assessment; modern series alone cannot reconstruct its disappearance.','not_established','rufum','10–18 °C; RH >80 %: not verified.',['native forest','water for larvae','chytrid fungus','microclimate'],'valdivia'),
(6,'caracol-oahu','Oʻahu tree snail','Achatinella apexfulva','Mollusc','terrestrial','Last known individual died','Hawaii DLNR, 2019; not an IUCN category','United States · Oʻahu','koolau',None,
 'Forests of the Koʻolau Mountains.','The last known individual died in captivity in 2019. Threats to Hawaiian snails include invasive species and climate; climate is not proven to be the sole cause for this species.','not_established','snail','16–22 °C: no tolerance evidence in the brief.',['introduced predators','host forest','microhabitat humidity','epiphytic food'],'hanawi'),
(7,'poouli','Poʻouli','Melamprosops phaeosoma','Bird','terrestrial','Extinct','USFWS, delisted due to extinction in 2023','United States · Maui','hanawi',2004,
 'Montane wet forest of Maui.','Habitat loss, introduced species and disease all matter; the brief does not show that warming-driven malaria alone explains the extinction.','not_established','poouli poouli_habitat','11–16 °C and >1500 m: do not treat as a guaranteed barrier against mosquitoes.',['disease and vectors','forest','snails/food','predators'],'hakalau'),
(8,'pupo-tecopa','Tecopa pupfish','Cyprinodon nevadensis calidae','Fish · subspecies','freshwater','Extinct','USFWS, 1981','United States · California','tecopa',None,
 'Outflows of two hot springs at Tecopa.','Modifying the springs for bathhouses altered flow and temperature; introduced fish are also considered. This is not evidence of extinction by global warming.','not_established','tecopa','26–36 °C and never >40 °C: not adopted; the official report describes temperatures differently.',['water temperature','flow','salinity','oxygen','introduced fish'],None),
(9,'millepora','Millepora hydrocoral','Millepora boschmai','Cnidarian','marine','Data Deficient','IUCN, published 2024 (assessed 2022)','Panama and Indo-Pacific','coiba',None,
 'Shallow reefs; distribution and taxonomy uncertain.','Severe declines and possible loss from Panama linked to ENSO; this is not global extinction. The latest assessment consulted is Data Deficient.','regional_documented','millepora','25–28 °C, anomalies >30 °C: not used as universal thresholds.',['sea-surface temperature','accumulated heat stress','pH','reef habitat'],None),
(10,'damisela-galapagos','Galápagos damsel','Azurina eupalama','Fish','marine','Critically Endangered; possibly extinct in cited sources','Charles Darwin Foundation / IUCN note 2019','Ecuador · Galápagos','galapagos',1983,
 'Coastal waters, rocky shores and reef areas.','ENSO is linked to its apparent disappearance; status and evidence must distinguish possible from confirmed extinction.','regional_documented','azurina azurina_pe','18–23 °C: not verified as a tolerance.',['sea temperature','productivity/plankton','upwelling','oxygen'],None),
(11,'eslizón-christmas','Christmas Island forest skink','Emoia nativitatis','Reptile','terrestrial','Extinct','Australia, declared 2021','Australia · Christmas Island','christmas',2010,
 'Christmas Island forest.','Confirmed extinction; predation by introduced species is relevant. Not attributed here to climate change. Replaces the brief row that mixed a pika and a rabbit.','not_established','skink skink_detail','Pika/rabbit ranges are not transferred to this reptile.',['invasive predators','forest','shelters','food'],'cocos'),
(12,'pupo-catarina','Catarina pupfish','Megupsilon aporus','Fish','freshwater','Extinct','Valdés González et al., Oryx','Mexico · Nuevo León','el-potosi',1994,
 'El Potosí spring and its aquatic surroundings.','Water extraction and habitat degradation are documented; the last captive fish died in 2014. Replaces the brief row that named no precise lake-fish species.','not_established','catarina','Chirostoma/Menidia ranges are not transferred.',['water table','flow','water temperature','oxygen','invasive fish'],None),
(13,'pez-mano','Smooth handfish','Sympterichthys unipennis','Fish','marine','Data Deficient','IUCN review, 2021','Australia · Tasmania','tasmania',None,
 'Coastal marine setting of Tasmania; few records.','The 2020 Extinct listing was revised to Data Deficient. There is no basis to claim a confirmed climate extinction.','not_established','handfish','11–16 °C: no support as a biological limit.',['seabed temperature','substrate','fishing pressure','presence surveys'],None),
(14,'pipistrelo-christmas','Christmas Island pipistrelle','Pipistrellus murrayi','Mammal','terrestrial','Extinct','Australia, listed 2021','Australia · Christmas Island','christmas',2009,
 'Rainforest, roost trees and insect-feeding areas.','The cause of decline is uncertain and multifactorial; invasive species and disturbance are key hypotheses. Do not present drought as a proven cause.','not_established','bat bat_habitat','24–28 °C: not adopted as a tolerance.',['roost trees','insects','invasive species','disease'],'cocos'),
(15,'rana-rabbs','Rabbs’ fringe-limbed treefrog','Ecnomiohyla rabborum','Amphibian','terrestrial','Critically Endangered, possibly extinct','IUCN, published 2019','Panama · El Valle de Antón','el-valle',2008,
 'Montane cloud forest; water-filled tree holes.','Decline and disease must be distinguished from causal attribution to warming. The death of the last known captive does not by itself make it Extinct.','not_established','rabbs rabbs_habitat','18–23 °C: not validated as a survival limit.',['phytotelmata','forest and trees','chytrid fungus','microclimate'],'santa-fe')]

def make():
    species=[]
    for row in ROWS:
        num,sid,name,sci,group,system,status,basis,region,loc,last,habitat,threat,climate,source,threshold,needs,candidate=row
        species.append(dict(id=sid,number=num,name=name,scientific_name=sci,taxonomic_rank='subspecies' if num==8 else 'species',group=group,system=system,status=status,status_basis=basis,region=region,reference_location=loc,last_wild_record_year=last,habitat=habitat,threat_summary=threat,climate_attribution=climate,source_ids=source.split(),pdf_threshold_claim=threshold,validated_tolerance_limits=None,required_local_evidence=needs,analogue_candidate=candidate,pdf_row=num,replacement_of={11:'Pika / rabbit; two taxa mixed',12:'Cichlid / Chirostoma / Menidia; no defined species'}.get(num),review_date='2026-11-14'))
    payload=dict(species=species,locations=[dict(id=i,name=n,latitude=lat,longitude=lon,coordinate_basis='Approximate point chosen by the analyst within the cited regional setting; not a plot or microhabitat observation.') for i,n,lat,lon in LOCATIONS],sources=[dict(id=k,title=v[0],url=v[1],accessed='2026-11-14') for k,v in SOURCES.items()])
    (ROOT/'catalogo-curado.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    return payload
if __name__=='__main__':make();print('15 fichas curadas; 24 localizaciones.')
