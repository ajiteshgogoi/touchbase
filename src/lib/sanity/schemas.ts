import post from './schema';
import author from './authorSchema';
import category from './categorySchema';

// Export all schemas
export const schemaTypes = [post, author, category];

// Export individual schemas for direct use 
export { post, author, category };