import type { Labels } from '../config'

// The bundled JPG is a 1024 × 512 EPSG:4326 export of this layer from NASA GIBS.
export const blueMarble = 'https://worldview.earthdata.nasa.gov/?l=BlueMarble_ShadedRelief_Bathymetry'
const csa = 'https://www.asc-csa.gc.ca/eng/satellites/everyday-lives/monitoring-and-protecting-our-ecosystems-from-space.asp'

type SpeciesPin = {
  id: string
  name: Labels
  scientificName: string
  region: Labels
  shortRegion: Labels
  latitude: number
  longitude: number
  status: 'EN' | 'CR'
  authority: string
  record: string
  context: { label: Labels; url: string }
}

export const creditsSpecies: readonly SpeciesPin[] = [
  {
    id: 'darwin-frog',
    name: ['Ranita de Darwin del sur', 'Southern Darwin’s frog'],
    scientificName: 'Rhinoderma darwinii',
    region: ['Chiloé, Chile', 'Chiloé, Chile'],
    shortRegion: ['Chiloé', 'Chiloé'],
    latitude: -42.5, longitude: -74,
    status: 'EN',
    authority: 'MMA Chile',
    record: 'https://simbio.mma.gob.cl/Especies/Details/12276',
    context: { label: ['Plan RECOGE de las ranitas de Darwin', 'Darwin’s frogs recovery plan'], url: 'https://simbio.mma.gob.cl/PlanesRecoge/VistaImpresion/1018' },
  },
  {
    id: 'right-whale',
    name: ['Ballena franca del Atlántico norte', 'North Atlantic right whale'],
    scientificName: 'Eubalaena glacialis',
    region: ['Golfo de San Lorenzo, Canadá', 'Gulf of St. Lawrence, Canada'],
    shortRegion: ['San Lorenzo', 'St. Lawrence'],
    latitude: 48.2, longitude: -62.7,
    status: 'EN',
    authority: 'DFO Canada · SARA',
    record: 'https://www.dfo-mpo.gc.ca/species-especes/mammals-mammiferes/whales-baleines/narw-bnan/index-eng.html',
    context: { label: ['Seguimiento satelital · recurso del reto', 'Satellite monitoring · challenge resource'], url: csa },
  },
  {
    id: 'mountain-gorilla',
    name: ['Gorila de montaña', 'Mountain gorilla'],
    scientificName: 'Gorilla beringei beringei',
    region: ['Macizo de Virunga, África central', 'Virunga Massif, Central Africa'],
    shortRegion: ['Virunga', 'Virunga'],
    latitude: -1.45, longitude: 29.5,
    status: 'EN',
    authority: 'IUCN',
    record: 'https://iucn.org/news/species/201811/fin-whale-mountain-gorilla-recovering-thanks-conservation-action-iucn-red-list',
    context: { label: ['Conservación en el paisaje de Virunga', 'Conservation in the Virunga landscape'], url: 'https://iucn.org/story/202609/iucn-showcases-conservation-gains-food-system-resilience-and-one-health-ppr-awareness' },
  },
  {
    id: 'sumatran-orangutan',
    name: ['Orangután de Sumatra', 'Sumatran orangutan'],
    scientificName: 'Pongo abelii',
    region: ['Ecosistema de Leuser, Indonesia', 'Leuser Ecosystem, Indonesia'],
    shortRegion: ['Sumatra', 'Sumatra'],
    latitude: 3.5, longitude: 97.3,
    status: 'CR',
    authority: 'IUCN',
    record: 'https://nc.iucnredlist.org/redlist/amazing-species/pongo-abelii/pdfs/original/pongo-abelii.pdf',
    context: { label: ['Hábitat de Gunung Leuser · UNESCO', 'Gunung Leuser habitat · UNESCO'], url: 'https://www.unesco.org/en/mab/gunung-leuser?hub=66369' },
  },
  {
    id: 'kangaroo-island-dunnart',
    name: ['Dunnart de la isla Canguro', 'Kangaroo Island dunnart'],
    scientificName: 'Sminthopsis aitkeni',
    region: ['Oeste de la isla Canguro, Australia', 'Western Kangaroo Island, Australia'],
    shortRegion: ['Isla Canguro', 'Kangaroo Island'],
    latitude: -35.95, longitude: 136.7,
    status: 'EN',
    authority: 'DCCEEW Australia · EPBC',
    record: 'https://www.dcceew.gov.au/environment/biodiversity/threatened/recovery-plans/recovery-plan-kangaroo-island-dunnart-sminthopsis-aitkeni',
    context: { label: ['Incendios de 2020 · NASA Landsat', '2020 fires · NASA Landsat'], url: 'https://science.nasa.gov/earth/earth-observatory/fires-ravage-kangaroo-island-146132/' },
  },
]
