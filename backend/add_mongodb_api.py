#!/usr/bin/env python3
"""
Script to add MongoDB API registration to app.py
"""

# Read the file
with open('app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line with "if __name__ == '__main__':"
insertion_index = None
for i, line in enumerate(lines):
    if line.strip() == "if __name__ == '__main__':":
        insertion_index = i
        break

if insertion_index is None:
    print("Error: Could not find 'if __name__ == '__main__':' in app.py")
    exit(1)

# Insert the MongoDB API registration before that line
new_lines = [
    "# Register MongoDB API routes\n",
    "try:\n",
    "    from api_mongodb import mongodb_api\n",
    "    app.register_blueprint(mongodb_api)\n",
    "    print(\"[INFO] MongoDB API endpoints registered\")\n",
    "except Exception as e:\n",
    "    print(f\"[WARN] MongoDB API not available: {str(e)}\")\n",
    "\n"
]

# Insert the new lines
lines[insertion_index:insertion_index] = new_lines

# Write back
with open('app.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✓ Successfully added MongoDB API registration to app.py")
