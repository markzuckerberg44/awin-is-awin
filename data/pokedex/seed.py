"""Curación explícita. Coordenadas de muestreo regional aproximadas, no parcelas."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
SOURCES={
'melomys':('Evaluación australiana del melomys, 2018','https://www.dcceew.gov.au/sites/default/files/env/consultations/d678432e-1ee8-4316-b1ef-af29634401d7/files/consultation-document-bramble-cay-melomys-2018.pdf'),
'erub':('Plan municipal de Erub','https://tsirc.qld.gov.au/wp-content/uploads/2024/11/Part-7-Erub-Darnley-Island-local-plan-code.pdf'),
'golden':('IUCN: Golden Toad','https://nc.iucnredlist.org/redlist/amazing-species/incilius-periglenes/pdfs/original/incilius-periglenes.pdf'),
'golden_climate':('Anchukaitis y Evans, 2010: variabilidad y sapo dorado','https://pubmed.ncbi.nlm.nih.gov/20194772/'),
'atelopus':('IUCN Amphibian Specialist Group, actualización 2020','https://www.iucn-amphibians.org/iucn-red-list-update/'),
'gastric':('Australian Museum: Australia’s Lost Frogs','https://australian.museum/learn/animals/frogs/herpetology-collection-australias-lost-frogs/'),
'rufum':('Chile: plan de recuperación de ranitas de Darwin, 2026','https://www.diariooficial.interior.gob.cl/publicaciones/2026/04/09/44420/01/2791873.pdf'),
'snail':('Hawaii DLNR: muerte del último Achatinella apexfulva conocido, 2019','https://dlnr.hawaii.gov/blog/2019/01/04/nr19-001/'),
'poouli':('USFWS: especies retiradas por extinción','https://ecos.fws.gov/ecp/report/species-delisted'),
'poouli_habitat':('Hawaii DLNR: Poʻouli','https://dlnr.hawaii.gov/wildlife/birds/poouli/'),
'tecopa':('USFWS: extinción del pupo de Tecopa, 1981','https://www.fws.gov/sites/default/files/documents/historic-news-releases/1981/19811118.PDF'),
'millepora':('IUCN Millepora boschmai, evaluación publicada 2024','https://doi.org/10.2305/IUCN.UK.2024-2.RLTS.T133300A174746646.en'),
'azurina':('Fundación Charles Darwin: Azurina eupalama','https://datazone.darwinfoundation.org/en/checklist/?species=13668'),
'azurina_pe':('IUCN: especies posiblemente extintas, 2019','https://nc.iucnredlist.org/redlist/content/attachment_files/2019_1_RL_Stats_Table_9.pdf'),
'skink':('Australia State of the Environment 2021: biodiversidad','https://soe.dcceew.gov.au/overview/environment/biodiversity'),
'skink_detail':('Evaluación australiana de Emoia nativitatis','https://www.dcceew.gov.au/sites/default/files/env/consultations/27bdb669-bdd2-4778-b679-652da87c20c1/files/consultation-document-emoia-nativitatus.pdf'),
'catarina':('Valdés González et al.: extinción de Megupsilon aporus, Oryx','https://www.cambridge.org/core/journals/oryx/article/extinction-of-the-catarina-pupfish-megupsilon-aporus-and-the-implications-for-the-conservation-of-freshwater-fish-in-mexico/B13134408D6EDDA38FEB6D9A474E2154'),
'handfish':('IUCN Sympterichthys unipennis, revisión 2021','https://doi.org/10.2305/IUCN.UK.2021-3.RLTS.T123423283A207621852.en'),
'bat':('Australia State of the Environment 2021: mamíferos','https://soe.dcceew.gov.au/sites/default/files/2022-07/soe2021-biodiversity.pdf'),
'bat_habitat':('Plan australiano del pipistrelo de Christmas','https://www.dcceew.gov.au/sites/default/files/documents/pipistrelle-murrayi.pdf'),
'rabbs':('IUCN Ecnomiohyla rabborum, publicada 2019','https://doi.org/10.2305/IUCN.UK.2019-1.RLTS.T85341796A54357363.en'),
'rabbs_habitat':('AMNH: Ecnomiohyla rabborum','https://amphibiansoftheworld.amnh.org/Amphibia/Anura/Hylidae/Ecnomiohyla/Ecnomiohyla-rabborum'),
'power':('NASA POWER, metodología meteorológica','https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/'),
'hamed':('Hamed y Rao, 1998','https://doi.org/10.1016/S0022-1694(97)00125-X')}

# ID, nombre, latitud, longitud; resolución de muestreo regional elegida por el analista.
LOCATIONS=[
('bramble-cay','Bramble Cay',-9.14244,143.877),('erub','Erub',-9.589,143.771),('funafuti','Funafuti',-8.524,179.195),('alice-springs','Alice Springs',-23.698,133.88),
('monteverde','Monteverde, entorno regional',10.30,-84.80),('san-gerardo','San Gerardo de Dota, entorno regional',9.55,-83.80),
('talamanca','Talamanca, entorno regional',9.40,-83.50),('boquete','Boquete, entorno regional',8.78,-82.43),
('conondale','Conondale, entorno regional',-26.70,152.60),('lamington','Lamington, entorno regional',-28.23,153.13),
('nahuelbuta','Nahuelbuta, entorno regional histórico',-37.80,-73.00),('valdivia','Valdivia, comparación regional',-39.81,-73.25),
('koolau','Koʻolau, Oʻahu, entorno regional',21.45,-157.85),('hanawi','Hanawi, Maui, entorno regional',20.75,-156.15),
('hakalau','Hakalau, Hawaiʻi, comparación regional',19.82,-155.30),('tecopa','Tecopa Hot Springs, entorno regional',35.88,-116.23),
('coiba','Coiba, entorno regional marino',7.60,-81.70),('galapagos','Santa Cruz, Galápagos, entorno regional',-0.75,-90.30),
('christmas','Christmas Island, entorno regional',-10.48,105.62),('cocos','Cocos (Keeling), comparación regional',-12.16,96.87),
('el-potosi','El Potosí, Nuevo León, entorno regional',24.87,-100.33),('tasmania','Canal D’Entrecasteaux, entorno regional',-43.20,147.20),
('el-valle','El Valle de Antón, entorno regional',8.63,-80.08),('santa-fe','Santa Fe, Panamá, comparación regional',8.51,-81.08)]

# Fichas de menos de 200 palabras por fuente; umbrales del PDF se conservan como no validados.
ROWS=[
(1,'melomys','Melomys de Bramble Cay','Melomys rubicola','Mamífero','terrestrial','Extinta','Evaluación australiana 2018 / listado federal 2019','Australia · estrecho de Torres','bramble-cay',2009,
 'Vegetación herbácea de un cayo bajo.','La inundación marina y la pérdida de vegetación sustentan el vínculo climático de este caso.','documented','melomys erub','Elevación >15 m; 25–31 °C: no usar como tolerancias demostradas.',['elevación de parcela','inundación marina','vegetación/alimento','depredadores invasores'],'erub'),
(2,'sapo-dorado','Sapo dorado de Monteverde','Incilius periglenes','Anfibio','terrestrial','Extinta','UICN, ficha de especie','Costa Rica · Monteverde','monteverde',1989,
 'Bosque nuboso y charcas temporales de reproducción.','Sequía asociada a ENSO y enfermedad se han propuesto; la atribución específica al calentamiento antropogénico es discutida.','disputed','golden golden_climate','14–19 °C; HR >90 %: sin fuente de tolerancia en el PDF.',['niebla','hidroperíodo de charcas','cobertura de bosque','quitridio'],'san-gerardo'),
(3,'arlequin-chiriqui','Rana arlequín de Chiriquí','Atelopus chiriquiensis','Anfibio','terrestrial','Extinta','UICN ASG, 2020','Costa Rica y Panamá · Talamanca','talamanca',1996,
 'Bosque montano y arroyos.','El declive se atribuye al menos parcialmente a quitridiomicosis; no está demostrado aquí que el calentamiento sea la causa única.','not_established','atelopus','12–17 °C en arroyos: rango no validado.',['temperatura del agua','oxígeno disuelto','caudal','quitridio'],'boquete'),
(4,'rana-gastrica','Rana incubadora gástrica del sur','Rheobatrachus silus','Anfibio','terrestrial','Extinta','Australian Museum / IUCN 2022','Australia · Queensland','conondale',1981,
 'Arroyos de bosque en las cordilleras Conondale y Blackall.','Las causas no se resolvieron antes de desaparecer; la enfermedad es una hipótesis relevante. No atribuir causalidad climática con estas series.','not_established','gastric','15–20 °C de agua: no verificado como tolerancia.',['temperatura del agua','caudal','bosque ribereño','patógenos'],'lamington'),
(5,'darwin-norte','Ranita de Darwin del norte','Rhinoderma rufum','Anfibio','terrestrial','En peligro crítico, posiblemente extinta','Plan oficial chileno, 2026','Chile · zona central y centro-sur','nahuelbuta',1981,
 'Bosque nativo y cursos de agua; punto climático regional, no población actual confirmada.','No registrada desde 1981. Pérdida de hábitat y enfermedad requieren evaluación; las series modernas no reconstruyen por sí solas su desaparición.','not_established','rufum','10–18 °C; HR >80 %: no verificados.',['bosque nativo','agua para larvas','quitridio','microclima'],'valdivia'),
(6,'caracol-oahu','Caracol arbóreo de Oʻahu','Achatinella apexfulva','Molusco','terrestrial','Último individuo conocido muerto','Hawaii DLNR, 2019; no sustituye una categoría UICN','Estados Unidos · Oʻahu','koolau',None,
 'Bosques de las montañas Koʻolau.','El último individuo conocido murió en cautiverio en 2019. Las amenazas a caracoles hawaianos incluyen invasoras y clima; no se prueba causalidad climática exclusiva para esta especie.','not_established','snail','16–22 °C: sin respaldo de tolerancia en el documento.',['depredadores introducidos','bosque huésped','humedad microambiental','alimento epífito'],'hanawi'),
(7,'poouli','Poʻouli','Melamprosops phaeosoma','Ave','terrestrial','Extinta','USFWS, retiro por extinción en 2023','Estados Unidos · Maui','hanawi',2004,
 'Bosque húmedo montano de Maui.','La pérdida de hábitat, especies introducidas y enfermedad son relevantes; el documento no demuestra que la malaria causada por calentamiento explique por sí sola la extinción.','not_established','poouli poouli_habitat','11–16 °C y >1500 m: no tratar como barrera garantizada contra mosquitos.',['enfermedad y vectores','bosque','caracoles/alimento','depredadores'],'hakalau'),
(8,'pupo-tecopa','Pupo de Tecopa','Cyprinodon nevadensis calidae','Pez · subespecie','freshwater','Extinta','USFWS, 1981','Estados Unidos · California','tecopa',None,
 'Efluentes de dos manantiales termales de Tecopa.','La modificación de manantiales para baños alteró el flujo y las condiciones térmicas; también se consideran peces introducidos. No es evidencia de extinción por calentamiento global.','not_established','tecopa','26–36 °C y nunca >40 °C: no adoptado; el informe oficial contiene otra descripción térmica.',['temperatura del agua','caudal','salinidad','oxígeno','peces introducidos'],None),
(9,'millepora','Hidrocoral Millepora','Millepora boschmai','Cnidario','marine','Datos insuficientes','UICN, publicada 2024 (evaluación 2022)','Panamá e Indo-Pacífico','coiba',None,
 'Arrecifes someros; distribución y taxonomía inciertas.','Fuertes declives y posible extirpación en Panamá asociados a ENSO; no equivale a extinción global. La evaluación más reciente consultada es DD.','regional_documented','millepora','25–28 °C, anomalías >30 °C: no usados como umbrales universales.',['temperatura superficial marina','estrés térmico acumulado','pH','hábitat arrecifal'],None),
(10,'damisela-galapagos','Damisela de las Galápagos','Azurina eupalama','Pez','marine','En peligro crítico; posible extinción en fuentes citadas','Fundación Charles Darwin / anotación IUCN 2019','Ecuador · Galápagos','galapagos',1983,
 'Aguas costeras, costas rocosas y zonas de arrecife.','ENSO se relaciona con su desaparición aparente; estado y evidencia deben distinguir extinción posible de confirmada.','regional_documented','azurina azurina_pe','18–23 °C: no verificado como tolerancia.',['temperatura del mar','productividad/plancton','surgencia','oxígeno'],None),
(11,'eslizón-christmas','Eslizón forestal de Christmas','Emoia nativitatis','Reptil','terrestrial','Extinta','Australia, declaración 2021','Australia · Christmas Island','christmas',2010,
 'Bosque de Christmas Island.','Extinción confirmada; depredación por especies introducidas es relevante. No se atribuye aquí a cambio climático. Reemplaza la fila que mezclaba pika y conejo.','not_established','skink skink_detail','No se transfieren rangos del pika/conejo a este reptil.',['depredadores invasores','bosque','refugios','alimento'],'cocos'),
(12,'pupo-catarina','Pupo de Catarina','Megupsilon aporus','Pez','freshwater','Extinta','Valdés González et al., Oryx','México · Nuevo León','el-potosi',1994,
 'Manantial de El Potosí y su entorno acuático.','La extracción de agua y degradación del hábitat están documentadas; murió el último cautivo en 2014. Reemplaza la fila sin especie precisa de peces lacustres.','not_established','catarina','No se transfieren rangos del conjunto Chirostoma/Menidia.',['nivel freático','caudal','temperatura del agua','oxígeno','peces invasores'],None),
(13,'pez-mano','Pez mano liso','Sympterichthys unipennis','Pez','marine','Datos insuficientes','Revisión UICN, 2021','Australia · Tasmania','tasmania',None,
 'Entorno marino costero de Tasmania; registros limitados.','La clasificación EX de 2020 fue revisada a DD. No hay base para afirmar una extinción climática confirmada.','not_established','handfish','11–16 °C: sin respaldo como límite biológico.',['temperatura del fondo','sustrato','presiones pesqueras','muestreos de presencia'],None),
(14,'pipistrelo-christmas','Pipistrelo de Christmas','Pipistrellus murrayi','Mamífero','terrestrial','Extinta','Australia, listado 2021','Australia · Christmas Island','christmas',2009,
 'Selva tropical, árboles de refugio y zonas de alimentación de insectos.','La causa del declive es incierta y multifactorial; invasoras y perturbación son hipótesis importantes. No presentar sequía como causa demostrada.','not_established','bat bat_habitat','24–28 °C: no adoptado como tolerancia.',['refugios arbóreos','insectos','invasoras','enfermedad'],'cocos'),
(15,'rana-rabbs','Rana arbórea de Rabbs','Ecnomiohyla rabborum','Anfibio','terrestrial','En peligro crítico, posiblemente extinta','UICN, publicada 2019','Panamá · El Valle de Antón','el-valle',2008,
 'Bosque nuboso montano; cavidades arbóreas con agua.','El declive y la enfermedad requieren distinguirse de una atribución causal al calentamiento. La muerte del último cautivo conocido no equivale por sí sola a categoría EX.','not_established','rabbs rabbs_habitat','18–23 °C: no validado como límite de supervivencia.',['fitotelmas','bosque y árboles','quitridio','microclima'],'santa-fe')]

def make():
    species=[]
    for row in ROWS:
        num,sid,name,sci,group,system,status,basis,region,loc,last,habitat,threat,climate,source,threshold,needs,candidate=row
        species.append(dict(id=sid,number=num,name=name,scientific_name=sci,taxonomic_rank='subspecies' if num==8 else 'species',group=group,system=system,status=status,status_basis=basis,region=region,reference_location=loc,last_wild_record_year=last,habitat=habitat,threat_summary=threat,climate_attribution=climate,source_ids=source.split(),pdf_threshold_claim=threshold,validated_tolerance_limits=None,required_local_evidence=needs,analogue_candidate=candidate,pdf_row=num,replacement_of={11:'Pika / conejo; dos taxones mezclados',12:'Cíclido / Chirostoma / Menidia; sin especie definida'}.get(num),review_date='2026-11-14'))
    payload=dict(species=species,locations=[dict(id=i,name=n,latitude=lat,longitude=lon,coordinate_basis='Punto aproximado seleccionado por el analista dentro del entorno regional citado; no observación de parcela ni microhábitat.') for i,n,lat,lon in LOCATIONS],sources=[dict(id=k,title=v[0],url=v[1],accessed='2026-11-14') for k,v in SOURCES.items()])
    (ROOT/'catalogo-curado.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    return payload
if __name__=='__main__':make();print('15 fichas curadas; 24 localizaciones.')
