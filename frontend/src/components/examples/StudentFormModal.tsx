import { useState } from 'react';
import StudentFormModal from '../StudentFormModal';
import { Button } from '@/components/ui/button';

export default function StudentFormModalExample() {
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = (student: any) => {
    console.log('Student saved:', student);
    setIsOpen(false);
  };

  return (
    <div className="p-6">
      <Button onClick={() => setIsOpen(true)}>Open Form Modal</Button>
      <StudentFormModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
        student={null}
      />
    </div>
  );
}
