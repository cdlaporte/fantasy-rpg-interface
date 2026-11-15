// Aggregates the three class definitions. Each class package owns its file under classdefs/.
import warrior from './classdefs/warrior.js';
import mage from './classdefs/mage.js';
import rogue from './classdefs/rogue.js';

export default { ...warrior, ...mage, ...rogue };
