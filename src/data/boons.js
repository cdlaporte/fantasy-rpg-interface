// Aggregates boon definitions. Each class package owns its file under boondefs/.
import warrior from './boondefs/warrior.js';
import mage from './boondefs/mage.js';
import rogue from './boondefs/rogue.js';

export default { ...warrior, ...mage, ...rogue };
