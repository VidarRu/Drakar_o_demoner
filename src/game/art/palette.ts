import { ramp, rgb } from './pixel';

/**
 * Färgskalor, från mörkast till ljusast. Dämpade jordtoner i stil med
 * de gamla Exile/Avernum-spelen: inget är riktigt mättat.
 */
export const PAL = {
  grass: ramp('#26391d', '#304826', '#3b562d', '#466535', '#53743d', '#628448', '#749656'),
  mud: ramp('#2c271d', '#383124', '#463d2d', '#544936'),
  dirt: ramp('#4c3b29', '#5d4932', '#6e573b', '#806645', '#92774f', '#a3875b', '#b39868'),
  wood: ramp('#3a2414', '#4a2f1a', '#5b3b21', '#6c4728', '#7e5430', '#8f6239', '#a07142'),
  cave: ramp('#2a2420', '#352d27', '#40372f', '#4c4137', '#584c40', '#65584a', '#726454'),
  water: ramp('#132a40', '#183451', '#1e3f60', '#264c6f', '#30597d', '#3d6a8d', '#4f7f9f'),
  foam: rgb('#7fa3b2'),
  sparkle: rgb('#6f98b0'),

  wallFace: ramp('#35323a', '#433f48', '#524d58', '#625c68', '#726c78', '#847e89', '#97919b'),
  wallTop: ramp('#25232a', '#2e2b33', '#38353e', '#433f49', '#4f4a55', '#5b5661'),
  mortar: rgb('#1f1d23'),
  window: ramp('#3a2a14', '#8a6420', '#d9a640', '#f2d27a'),

  rockTop: ramp('#0b0a0c', '#141317', '#1e1c21', '#29262c', '#353139', '#423d46', '#514b55'),
  rockFace: ramp('#2a231f', '#372e28', '#453a32', '#54473d', '#635548', '#736354', '#857361'),

  doorWood: ramp('#2e1c0e', '#4a2f17', '#61401f', '#775028', '#8b6031'),
  iron: ramp('#1b1b1f', '#2e2e34', '#46464e'),
  brass: rgb('#d8b84a'),

  spruce: ramp('#0d1c14', '#13281b', '#193421', '#204229', '#295133', '#33623d', '#43774a'),
  leaf: ramp('#1a2f15', '#243f1c', '#2f5124', '#3b632c', '#497535', '#5a8a40', '#70a04d'),
  bark: ramp('#2a1b10', '#3b2716', '#4e341d', '#634427'),
  birch: ramp('#5a5650', '#9d978c', '#cfc9bc', '#e8e3d6'),
};
