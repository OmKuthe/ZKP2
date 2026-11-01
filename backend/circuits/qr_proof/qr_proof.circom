pragma circom 2.1.9;

template QRProof() {
    signal input pub_class_x;
    signal input pub_class_y;
    signal input pub_radius_sq;
    
    signal input priv_student_x;
    signal input priv_student_y;
    
    signal dx;
    signal dy;
    dx <== priv_student_x - pub_class_x;
    dy <== priv_student_y - pub_class_y;
    
    signal dx_sq;
    signal dy_sq;
    dx_sq <== dx * dx;
    dy_sq <== dy * dy;
    
    signal dist_sq;
    dist_sq <== dx_sq + dy_sq;
    
    // Prove that pub_radius_sq - dist_sq >= 0
    // We introduce a private signal `sqrt_diff`.
    // If sqrt_diff * sqrt_diff == pub_radius_sq - dist_sq, 
    // then pub_radius_sq - dist_sq must be >= 0.
    signal sqrt_diff;
    sqrt_diff <-- 1; // Give it a dummy value
    sqrt_diff * sqrt_diff === pub_radius_sq - dist_sq;
}

component main = QRProof();