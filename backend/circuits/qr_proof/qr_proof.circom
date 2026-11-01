pragma circom 2.1.9;

// Import the comparator from circomlib
include "circomlib/circuits/comparators.circom";

template QRProof() {
    // Public inputs
    signal input pub_class_x;
    signal input pub_class_y;
    signal input pub_radius_sq;
    
    // Private inputs
    signal input priv_student_x;
    signal input priv_student_y;
    
    // Calculate differences
    signal dx;
    signal dy;
    dx <== priv_student_x - pub_class_x;
    dy <== priv_student_y - pub_class_y;
    
    // Square the differences
    signal dx_sq;
    signal dy_sq;
    dx_sq <== dx * dx;
    dy_sq <== dy * dy;
    
    // Calculate distance squared
    signal dist_sq;
    dist_sq <== dx_sq + dy_sq;
    
    // Use LessEqThan to check dist_sq <= pub_radius_sq
    // 64 means we check up to 64 bits of precision (enough for our scaled coordinates)
    component lessEq = LessEqThan(64);
    lessEq.in[0] <== dist_sq;
    lessEq.in[1] <== pub_radius_sq;
    
    // Enforce that the output is 1 (true)
    lessEq.out === 1;
}

component main = QRProof();