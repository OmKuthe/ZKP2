pragma circom 2.1.9;

template Proximity() {
    // Public inputs (known to server)
    signal input pub_class_x;
    signal input pub_class_y;
    signal input pub_radius_sq;
    
    // Private inputs (only student's phone knows)
    signal input priv_student_x;
    signal input priv_student_y;
    
    // Calculate differences
    signal dx;
    signal dy;
    dx <-- priv_student_x - pub_class_x;
    dy <-- priv_student_y - pub_class_y;
    
    // Square the differences
    signal dx_sq;
    signal dy_sq;
    dx_sq <-- dx * dx;
    dy_sq <-- dy * dy;
    
    // Calculate distance squared
    signal dist_sq;
    dist_sq <-- dx_sq + dy_sq;
    
    // Compare distance squared with radius squared
    signal is_inside;
    is_inside <-- (dist_sq <= pub_radius_sq);
    
    // Constraint: is_inside must be 1 (true)
    is_inside === 1;
}

component main {public [pub_class_x, pub_class_y, pub_radius_sq]} = Proximity();